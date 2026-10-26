// Media building blocks shared by every section: uploader, grid with bulk
// actions and drag-reorder, edit drawer, library picker and image field.
import { api, uploadFile } from './api.js';
import { h, toast, fail, openDrawer, openModal, confirmDialog, field, select, formatDate, formatDuration, makeSortable } from './ui.js';

export const GALLERY_CATEGORIES = [
  ['photography', 'Photography'],
  ['editing', 'Editing & Design'],
  ['achievements', 'Achievements'],
  ['reels', 'Reels'],
  ['team-bts', 'Team BTS'],
  ['archives', 'Archives'],
  ['sports', 'Sports']
];

export const ALL_CATEGORIES = [
  ...GALLERY_CATEGORIES,
  ['videography', 'Videography'],
  ['site', 'Site assets (covers, posters, avatars)']
];

export const VIDEO_SUBCATEGORIES = [
  ['aftermovie', 'Aftermovie'],
  ['highlight', 'Highlight'],
  ['reel', 'Reel'],
  ['documentary', 'Documentary'],
  ['other', 'Other']
];

const categoryLabel = (value) => (ALL_CATEGORIES.find(([v]) => v === value) || [value, value])[1];

const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp';
const VIDEO_ACCEPT = '.mp4,.mov,.webm';
export const ACCEPT = { image: IMAGE_ACCEPT, video: VIDEO_ACCEPT, any: `${IMAGE_ACCEPT},${VIDEO_ACCEPT}` };
const MAX_BYTES = 100 * 1024 * 1024;

// ---------- Lookups used by the editor (cached per page load) ----------
let membersCache = null;
let eventsCache = null;

export async function getMembers(force = false) {
  if (!membersCache || force) {
    const res = await api('/api/team/manage');
    membersCache = res.data;
  }
  return membersCache;
}

export async function getEvents(force = false) {
  if (!eventsCache || force) {
    const res = await api('/api/events', { query: { limit: 500 } });
    eventsCache = res.data;
  }
  return eventsCache;
}

export function invalidateLookups() {
  membersCache = null;
  eventsCache = null;
}

// ---------- Thumbnail ----------
export function mediaThumb(item) {
  if (item.type === 'video' && !item.posterUrl) {
    return h('video', { src: `${item.fileUrl}#t=1`, muted: true, preload: 'metadata', playsInline: true });
  }
  const src = item.type === 'video' ? item.posterUrl : (item.thumbnailUrl || item.fileUrl);
  return h('img', { src, alt: '', loading: 'lazy' });
}

// ---------- Uploader ----------
/**
 * opts.fields(): returns form fields for each upload (category, eventId, ...)
 * opts.accept: file input accept string
 * opts.showPublishToggle: show "publish immediately" checkbox (default true)
 * opts.onUploaded(items): called once the batch finishes
 */
export function createUploader(opts) {
  const input = h('input', { type: 'file', multiple: opts.multiple !== false, accept: opts.accept || ACCEPT.any, hidden: true });
  const list = h('div.upload-list');
  const publish = h('input', { type: 'checkbox', checked: true });

  const zone = h('div.dropzone', { tabindex: '0', role: 'button' }, [
    h('strong', {}, opts.label || 'Drop photos or videos here, or click to choose'),
    h('span', {}, 'JPG, PNG, WEBP, MP4, MOV, WEBM · up to 100 MB each')
  ]);

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    run([...e.dataTransfer.files]);
  });
  input.addEventListener('change', () => {
    run([...input.files]);
    input.value = '';
  });

  async function run(files) {
    if (!files.length) return;
    const allowed = (opts.accept || ACCEPT.any).split(',');
    const jobs = files.map((file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const bar = h('i');
      const state = h('div.state', {}, 'Waiting');
      const row = h('div.upload-row', {}, [h('div.name', { title: file.name }, file.name), h('div.bar', {}, [bar]), state]);
      list.prepend(row);
      let error = null;
      if (!allowed.includes(ext)) error = `${ext} files aren't allowed here`;
      else if (file.size > MAX_BYTES) error = 'Larger than 100 MB';
      if (error) {
        row.classList.add('error');
        state.textContent = 'Skipped';
        row.append(h('div.err', {}, error));
      }
      return { file, bar, state, row, skip: Boolean(error) };
    });

    const queue = jobs.filter(j => !j.skip);
    const done = [];
    const worker = async () => {
      while (queue.length) {
        const job = queue.shift();
        job.state.textContent = 'Uploading';
        try {
          const fields = { ...(opts.fields ? opts.fields() : {}) };
          if (opts.showPublishToggle !== false && fields.publish === undefined) fields.publish = String(publish.checked);
          const item = await uploadFile(job.file, fields, (p) => {
            job.bar.style.width = `${Math.round(p * 100)}%`;
            job.state.textContent = p >= 1 ? 'Processing' : `${Math.round(p * 100)}%`;
          });
          job.bar.style.width = '100%';
          job.row.classList.add('done');
          job.state.textContent = 'Done';
          done.push(item);
        } catch (err) {
          job.row.classList.add('error');
          job.state.textContent = 'Failed';
          job.row.append(h('div.err', {}, err.message));
        }
      }
    };
    await Promise.all([worker(), worker()]);

    if (done.length) {
      toast(`${done.length} file${done.length > 1 ? 's' : ''} uploaded`);
      opts.onUploaded?.(done);
    }
    // Clear finished rows after a moment, keep failures visible
    setTimeout(() => list.querySelectorAll('.upload-row.done').forEach(r => r.remove()), 4000);
  }

  const optsRow = opts.showPublishToggle === false ? null : h('div.upload-opts', {}, [
    h('label.check', {}, [publish, 'Publish immediately']),
    opts.extraOptions || null
  ]);

  return h('div.uploader', {}, [zone, input, optsRow, list]);
}

// ---------- Media browser (toolbar + bulk bar + grid) ----------
/**
 * opts.query: fixed filters always sent (category, eventId, type, subcategory)
 * opts.controls: which filters to show: 'search', 'type', 'status', 'category', 'subcategory'
 * opts.sortable: allow drag-reorder when the full set is loaded
 * opts.emptyText
 */
export function createMediaBrowser(opts) {
  const state = {
    items: [],
    total: 0,
    page: 1,
    selected: new Set(),
    filters: { status: 'all', search: '', type: '', category: '', subcategory: '' }
  };
  const controls = opts.controls || ['search', 'type', 'status'];

  const grid = h('div.media-grid');
  const moreWrap = h('div.load-more');
  const bulkbar = h('div.bulkbar', { hidden: true });
  const hint = h('span.hint');
  const toolbar = h('div.toolbar');

  // Toolbar
  if (controls.includes('search')) {
    let t;
    toolbar.append(h('input', {
      type: 'search', placeholder: 'Search title, file name, tags', class: 'grow',
      oninput: (e) => { clearTimeout(t); t = setTimeout(() => { state.filters.search = e.target.value.trim(); load(); }, 300); }
    }));
  }
  if (controls.includes('category')) {
    toolbar.append(select([['', 'All categories'], ...ALL_CATEGORIES], '', {
      'aria-label': 'Category', onchange: (e) => { state.filters.category = e.target.value; load(); }
    }));
  }
  if (controls.includes('subcategory')) {
    toolbar.append(select([['', 'All types'], ...VIDEO_SUBCATEGORIES], '', {
      'aria-label': 'Video type', onchange: (e) => { state.filters.subcategory = e.target.value; load(); }
    }));
  }
  if (controls.includes('type')) {
    toolbar.append(select([['', 'Photos & videos'], ['image', 'Photos'], ['video', 'Videos']], '', {
      'aria-label': 'Media type', onchange: (e) => { state.filters.type = e.target.value; load(); }
    }));
  }
  if (controls.includes('status')) {
    toolbar.append(select([['all', 'Published & drafts'], ['draft', 'Drafts only']], 'all', {
      'aria-label': 'Status', onchange: (e) => { state.filters.status = e.target.value; load(); }
    }));
  }
  toolbar.append(hint);

  function query(page) {
    const f = state.filters;
    return {
      status: f.status === 'draft' ? 'draft' : 'all',
      search: f.search,
      type: f.type,
      category: f.category,
      subcategory: f.subcategory,
      ...opts.query,
      page,
      limit: 60
    };
  }

  const canSort = () => opts.sortable
    && !state.filters.search && !state.filters.type && state.filters.status === 'all'
    && state.items.length >= state.total;

  async function load(append = false) {
    const page = append ? state.page + 1 : 1;
    if (!append) {
      grid.replaceChildren(h('div.spinner', {}, 'Loading…'));
      state.selected.clear();
    }
    try {
      const res = await api('/api/media', { query: query(page) });
      state.page = page;
      state.total = res.total;
      state.items = append ? [...state.items, ...res.data] : res.data;
      render();
    } catch (err) {
      grid.replaceChildren(h('div.empty', {}, `Couldn't load media: ${err.message}`));
    }
  }

  function render() {
    grid.replaceChildren();
    if (!state.items.length) {
      grid.append(h('div.empty', { style: { gridColumn: '1 / -1' } }, opts.emptyText || 'Nothing here yet. Upload something above.'));
    }
    const sortable = canSort();
    for (const item of state.items) grid.append(card(item, sortable));

    moreWrap.replaceChildren();
    if (state.items.length < state.total) {
      moreWrap.append(h('button.btn', { type: 'button', onclick: () => load(true) }, `Load more (${state.total - state.items.length} left)`));
    }

    if (opts.sortable) {
      hint.textContent = sortable
        ? `${state.total} item${state.total === 1 ? '' : 's'} · drag to reorder`
        : `${state.total} item${state.total === 1 ? '' : 's'}${state.items.length < state.total ? ' · load all to reorder' : ''}`;
    } else {
      hint.textContent = `${state.total} item${state.total === 1 ? '' : 's'}`;
    }
    renderBulk();
  }

  function card(item, sortable) {
    const checkbox = h('input.select', {
      type: 'checkbox', 'aria-label': 'Select', checked: state.selected.has(item.id),
      onclick: (e) => e.stopPropagation(),
      onchange: (e) => {
        if (e.target.checked) state.selected.add(item.id); else state.selected.delete(item.id);
        el.classList.toggle('selected', e.target.checked);
        renderBulk();
      }
    });

    const badges = h('div.badges', {}, [
      item.isPublished ? h('span.badge.live', {}, 'Live') : h('span.badge.draft', {}, 'Draft'),
      item.isFeatured ? h('span.badge.feat', {}, '★ Featured') : null,
      item.type === 'video' ? h('span.badge.vid', {}, formatDuration(item.durationSec) || 'Video') : null
    ]);

    const sub = [
      opts.query?.category ? null : categoryLabel(item.category),
      item.subcategory,
      item.eventName
    ].filter(Boolean).join(' · ') || formatDate(item.createdAt);

    const el = h('div.card', {
      dataset: { id: item.id },
      draggable: sortable,
      class: state.selected.has(item.id) ? 'selected' : ''
    }, [
      h('div.thumb', { onclick: () => edit(item) }, [mediaThumb(item), badges, checkbox]),
      h('div.meta', {}, [
        h('div.title', { title: item.title }, item.title),
        h('div.sub', {}, sub)
      ])
    ]);
    return el;
  }

  function edit(item) {
    openMediaEditor(item, {
      onSaved: (updated) => {
        const i = state.items.findIndex(x => x.id === updated.id);
        const stillMatches = !opts.query?.category || updated.category === opts.query.category;
        const stillInEvent = !opts.query?.eventId || updated.eventId === opts.query.eventId;
        if (i >= 0 && stillMatches && stillInEvent) state.items[i] = updated;
        else if (i >= 0) { state.items.splice(i, 1); state.total--; }
        render();
        opts.onChange?.();
      },
      onDeleted: (id) => {
        state.items = state.items.filter(x => x.id !== id);
        state.total--;
        render();
        opts.onChange?.();
      }
    });
  }

  function renderBulk() {
    const n = state.selected.size;
    bulkbar.hidden = n === 0;
    if (!n) return;
    const ids = [...state.selected];
    const run = async (action, extra = {}) => {
      try {
        await api('/api/media/bulk', { method: 'PATCH', body: { ids, action, ...extra } });
        toast(`Done: ${action} on ${ids.length} item${ids.length > 1 ? 's' : ''}`);
        await load();
        opts.onChange?.();
      } catch (err) { fail(err); }
    };
    const moveSelect = select([['', 'Move to…'], ...ALL_CATEGORIES], '', {
      'aria-label': 'Move to category',
      onchange: (e) => { if (e.target.value) run('move', { category: e.target.value }); }
    });
    moveSelect.style.width = 'auto';

    bulkbar.replaceChildren(
      h('strong', {}, `${n} selected`),
      h('button.btn.btn-sm', { type: 'button', onclick: () => run('publish') }, 'Publish'),
      h('button.btn.btn-sm', { type: 'button', onclick: () => run('unpublish') }, 'Unpublish'),
      h('button.btn.btn-sm', { type: 'button', onclick: () => run('feature') }, 'Feature'),
      h('button.btn.btn-sm', { type: 'button', onclick: () => run('unfeature') }, 'Unfeature'),
      opts.extraBulk ? opts.extraBulk(ids, run) : null,
      moveSelect,
      h('button.btn.btn-sm.btn-danger', {
        type: 'button',
        onclick: async () => {
          if (await confirmDialog(`Delete ${n} item${n > 1 ? 's' : ''}? This removes the files too and can't be undone.`)) run('delete');
        }
      }, 'Delete'),
      h('button.btn.btn-sm.btn-ghost', {
        type: 'button',
        onclick: () => { state.selected.clear(); render(); }
      }, 'Clear'),
      h('button.btn.btn-sm.btn-ghost', {
        type: 'button',
        onclick: () => { state.items.forEach(i => state.selected.add(i.id)); render(); }
      }, 'Select all loaded')
    );
  }

  if (opts.sortable) {
    makeSortable(grid, '.card', async (ids) => {
      if (!canSort()) return;
      state.items = ids.map(id => state.items.find(i => i.id === id));
      try {
        await api('/api/media/reorder', { method: 'PATCH', body: { items: ids.map((id, i) => ({ id, sortOrder: i + 1 })) } });
        toast('Order saved');
      } catch (err) { fail(err); load(); }
    });
  }

  const el = h('div.media-browser', {}, [toolbar, bulkbar, grid, moreWrap]);
  load();

  return {
    el,
    reload: () => load(),
    setQuery: (q) => { opts.query = q; load(); },
    prepend: (items) => {
      state.items = [...items.filter(i => !state.items.some(x => x.id === i.id)), ...state.items];
      state.total += items.length;
      render();
    }
  };
}

// ---------- Edit drawer ----------
export function openMediaEditor(item, { onSaved, onDeleted } = {}) {
  openDrawer(async (drawer, close) => {
    const preview = item.type === 'video'
      ? h('video', { src: item.fileUrl, poster: item.posterUrl || undefined, controls: true, preload: 'metadata' })
      : h('img', { src: item.fileUrl, alt: '' });

    const title = h('input', { type: 'text', value: item.title || '', maxlength: '200' });
    const description = h('textarea', { rows: 3, maxlength: '2000' }, item.description || '');
    const category = select(ALL_CATEGORIES, item.category);
    const subcategory = select([['', '—'], ...VIDEO_SUBCATEGORIES], item.subcategory || '');
    const subField = field('Video type', subcategory);
    const syncSub = () => { subField.hidden = category.value !== 'videography'; };
    category.addEventListener('change', syncSub);
    syncSub();

    const eventSel = select([['', 'No event']], '');
    const tags = h('input', { type: 'text', value: (item.tags || []).join(', '), placeholder: 'comma, separated' });
    const exif = h('input', { type: 'text', value: item.exif || '', placeholder: 'e.g. Sony A7 IV · 85mm · f/1.4' });
    const published = h('input', { type: 'checkbox', checked: item.isPublished });
    const featured = h('input', { type: 'checkbox', checked: item.isFeatured });

    // Poster (videos only)
    let posterUrl = item.posterUrl || null;
    const posterField = item.type === 'video'
      ? field('Poster image', imageField({ value: posterUrl, onChange: (url) => { posterUrl = url; } }), 'Shown before the video plays.')
      : null;

    // Credits
    const credits = (item.credits || []).map(c => ({ userId: c.userId, role: c.role || '' }));
    const creditList = h('div.stack');
    let members = [];
    const renderCredits = () => {
      creditList.replaceChildren(...credits.map((c, i) => h('div.credit-row', {}, [
        select([['', 'Choose member'], ...members.map(m => [m.id, m.name])], c.userId, {
          'aria-label': 'Member', onchange: (e) => { c.userId = e.target.value; }
        }),
        h('input', { type: 'text', value: c.role, placeholder: 'Role, e.g. Lead Photographer', oninput: (e) => { c.role = e.target.value; } }),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Remove credit', onclick: () => { credits.splice(i, 1); renderCredits(); } }, '✕')
      ])));
    };

    const save = h('button.btn.btn-primary', { type: 'button' }, 'Save');
    const del = h('button.btn.btn-danger', { type: 'button' }, 'Delete');

    drawer.append(
      h('div.drawer-head', {}, [h('h2', {}, 'Edit media'), h('button.icon-btn', { type: 'button', 'aria-label': 'Close', onclick: close }, '✕')]),
      h('div.preview-media', {}, [preview]),
      h('dl.facts', {}, [
        h('dt', {}, 'File'), h('dd', {}, item.fileName),
        h('dt', {}, 'Size'), h('dd', {}, [item.size, item.res, formatDuration(item.durationSec)].filter(Boolean).join(' · ') || '—'),
        h('dt', {}, 'Uploaded'), h('dd', {}, [formatDate(item.createdAt), item.uploadedBy].filter(Boolean).join(' by ')),
        h('dt', {}, 'Link'), h('dd', {}, [h('a', { href: item.fileUrl, target: '_blank', rel: 'noopener' }, 'Open original')])
      ]),
      field('Title', title),
      field('Description', description),
      h('div.form-grid', {}, [field('Category', category), subField]),
      field('Event', eventSel),
      posterField,
      field('Tags', tags),
      item.type === 'image' ? field('Camera details', exif, 'Shown on photography cards.') : null,
      h('div.chips', {}, [h('label.check', {}, [published, 'Published']), h('label.check', {}, [featured, 'Featured'])]),
      h('div.field', {}, [
        h('span', {}, 'Credits (appears on these members\' portfolios)'),
        creditList,
        h('button.btn.btn-sm', { type: 'button', onclick: () => { credits.push({ userId: '', role: '' }); renderCredits(); } }, '+ Add credit')
      ]),
      h('div.drawer-foot', {}, [del, h('div.chips', {}, [h('button.btn.btn-ghost', { type: 'button', onclick: close }, 'Cancel'), save])])
    );

    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const body = {
          title: title.value.trim() || null,
          description: description.value.trim() || null,
          category: category.value,
          subcategory: category.value === 'videography' ? (subcategory.value || null) : null,
          eventId: eventSel.value || null,
          tags: tags.value.split(',').map(s => s.trim()).filter(Boolean),
          isPublished: published.checked,
          isFeatured: featured.checked,
          credits: credits.filter(c => c.userId).map(c => ({ userId: c.userId, role: c.role.trim() || null }))
        };
        if (item.type === 'image') body.exif = exif.value.trim() || null;
        if (item.type === 'video') body.posterUrl = posterUrl;
        const res = await api(`/api/media/${item.id}`, { method: 'PATCH', body });
        toast('Saved');
        close();
        onSaved?.(res.data);
      } catch (err) {
        fail(err);
        save.disabled = false;
      }
    });

    del.addEventListener('click', async () => {
      if (!(await confirmDialog(`Delete "${item.title}"? The file is removed too and this can't be undone.`))) return;
      try {
        await api(`/api/media/${item.id}`, { method: 'DELETE' });
        toast('Deleted');
        close();
        onDeleted?.(item.id);
      } catch (err) { fail(err); }
    });

    // Fill lookups after first paint
    try {
      const [events, mem] = await Promise.all([getEvents(), getMembers()]);
      members = mem;
      eventSel.replaceChildren(...[['', 'No event'], ...events.map(e => [e.id, e.title])].map(([v, l]) =>
        h('option', { value: v, selected: v === (item.eventId || '') }, l)));
      renderCredits();
    } catch (err) { fail(err); }
  });
}

// ---------- Library picker ----------
/**
 * Resolves with the chosen media items ([] if cancelled).
 * opts.query: filters (type, category, ...); opts.multiple; opts.title; opts.exclude: Set of ids
 */
export function pickMedia(opts = {}) {
  return new Promise((resolve) => {
    const m = openModal(opts.title || 'Choose from library');
    const chosen = new Map();
    const exclude = opts.exclude || new Set();
    const grid = h('div.media-grid');
    const more = h('div.load-more');
    const count = h('span.hint');
    let page = 1;
    let search = '';
    let category = opts.query?.category || '';

    const confirm = h('button.btn.btn-primary', { type: 'button', disabled: true }, opts.multiple ? 'Add selected' : 'Use this');
    let resolved = false;
    const finish = (items) => { if (resolved) return; resolved = true; m.close(); resolve(items); };

    let t;
    const toolbar = h('div.toolbar', {}, [
      h('input', {
        type: 'search', placeholder: 'Search', class: 'grow',
        oninput: (e) => { clearTimeout(t); t = setTimeout(() => { search = e.target.value.trim(); load(); }, 300); }
      }),
      opts.lockCategory ? null : select([['', 'All categories'], ...ALL_CATEGORIES], category, {
        'aria-label': 'Category', onchange: (e) => { category = e.target.value; load(); }
      }),
      count
    ]);

    async function load(append = false) {
      page = append ? page + 1 : 1;
      if (!append) grid.replaceChildren(h('div.spinner', {}, 'Loading…'));
      try {
        const res = await api('/api/media', { query: { status: 'all', limit: 60, ...opts.query, category, search, page } });
        if (!append) grid.replaceChildren();
        const items = res.data.filter(i => !exclude.has(i.id));
        if (!append && !items.length) grid.append(h('div.empty', { style: { gridColumn: '1 / -1' } }, 'No matching media.'));
        for (const item of items) {
          const el = h('div.card', { class: chosen.has(item.id) ? 'selected' : '' }, [
            h('div.thumb', {}, [mediaThumb(item), h('div.badges', {}, [
              item.isPublished ? null : h('span.badge.draft', {}, 'Draft'),
              item.type === 'video' ? h('span.badge.vid', {}, 'Video') : null
            ])]),
            h('div.meta', {}, [h('div.title', {}, item.title), h('div.sub', {}, [categoryLabel(item.category), item.eventName].filter(Boolean).join(' · '))])
          ]);
          el.addEventListener('click', () => {
            if (!opts.multiple) {
              chosen.clear();
              grid.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
            }
            if (chosen.has(item.id)) chosen.delete(item.id); else chosen.set(item.id, item);
            el.classList.toggle('selected', chosen.has(item.id));
            confirm.disabled = chosen.size === 0;
            count.textContent = chosen.size ? `${chosen.size} selected` : '';
          });
          el.addEventListener('dblclick', () => { if (!opts.multiple) finish([item]); });
          grid.append(el);
        }
        more.replaceChildren();
        if (page * 60 < res.total) more.append(h('button.btn', { type: 'button', onclick: () => load(true) }, 'Load more'));
      } catch (err) {
        grid.replaceChildren(h('div.empty', {}, err.message));
      }
    }

    m.body.append(toolbar, grid, more);
    m.foot.append(h('button.btn.btn-ghost', { type: 'button', onclick: () => finish([]) }, 'Cancel'), confirm);
    confirm.addEventListener('click', () => finish([...chosen.values()]));
    // Overlay click / Esc also resolve
    const observer = new MutationObserver(() => {
      if (!document.body.contains(m.body)) { observer.disconnect(); finish([]); }
    });
    observer.observe(document.body, { childList: true });
    load();
  });
}

// ---------- Single image field (covers, avatars, posters) ----------
/**
 * Preview + Upload / Choose / Remove. Uploads go to the internal "site"
 * category as drafts so they never appear in public galleries.
 */
export function imageField({ value, round = false, onChange, uploadFields = {} }) {
  const preview = h('div.preview', { class: round ? 'round' : '' });
  const input = h('input', { type: 'file', accept: ACCEPT.image, hidden: true });
  const remove = h('button.btn.btn-sm.btn-ghost', { type: 'button' }, 'Remove');
  const status = h('span.hint');

  const set = (url) => {
    value = url || null;
    preview.style.backgroundImage = value ? `url("${value.replace(/"/g, '%22')}")` : '';
    remove.hidden = !value;
    onChange?.(value);
  };

  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) return toast('Image is larger than 100 MB', 'error');
    status.textContent = 'Uploading…';
    try {
      const item = await uploadFile(file, { category: 'site', publish: 'false', ...uploadFields }, (p) => {
        status.textContent = `Uploading ${Math.round(p * 100)}%`;
      });
      set(item.fileUrl);
      status.textContent = '';
    } catch (err) {
      status.textContent = '';
      fail(err);
    }
  });
  remove.addEventListener('click', () => set(null));

  // Initial paint without firing onChange
  preview.style.backgroundImage = value ? `url("${value.replace(/"/g, '%22')}")` : '';
  remove.hidden = !value;

  return h('div.image-field', {}, [
    preview,
    h('div.btns', {}, [
      h('button.btn.btn-sm', { type: 'button', onclick: () => input.click() }, 'Upload'),
      h('button.btn.btn-sm', {
        type: 'button',
        onclick: async () => {
          const [item] = await pickMedia({ title: 'Choose an image', query: { type: 'image' } });
          if (item) set(item.fileUrl);
        }
      }, 'Choose from library'),
      remove,
      status
    ]),
    input
  ]);
}
