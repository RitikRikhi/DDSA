// Events: list of events, and an editor for details, cover, publishing and media.
import { api } from './api.js';
import { h, toast, fail, openModal, confirmDialog, field, select, formatDate } from './ui.js';
import { createUploader, createMediaBrowser, imageField, pickMedia, invalidateLookups } from './media.js';

const STATUSES = [['planning', 'Upcoming'], ['live', 'Live now'], ['completed', 'Completed']];

export async function renderEvents(view) {
  const list = h('div.list-grid', {}, [h('div.spinner', {}, 'Loading…')]);
  const search = h('input', { type: 'search', placeholder: 'Search events', class: 'grow' });
  const visibility = select([['all', 'All events'], ['published', 'Published'], ['draft', 'Drafts']], 'all', { 'aria-label': 'Visibility' });
  visibility.style.width = 'auto';

  view.replaceChildren(
    h('div.page-head', {}, [
      h('div', {}, [h('h1', {}, 'Events'), h('p', {}, 'Each published event gets its own page on the site with its cover, story, photos and films.')]),
      h('button.btn.btn-primary', { type: 'button', onclick: newEvent }, '+ New event')
    ]),
    h('div.toolbar', {}, [search, visibility]),
    list
  );

  let events = [];
  try {
    events = (await api('/api/events', { query: { limit: 500 } })).data;
  } catch (err) {
    list.replaceChildren(h('div.empty', {}, `Couldn't load events: ${err.message}`));
    return;
  }

  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const shown = events.filter(e =>
      (!q || [e.title, e.venue].some(v => (v || '').toLowerCase().includes(q))) &&
      (visibility.value === 'all' || (visibility.value === 'published') === e.isPublished));
    list.replaceChildren(...(shown.length ? shown.map(eventCard) : [h('div.empty', { style: { gridColumn: '1 / -1' } }, 'No events match.')]));
  };
  search.addEventListener('input', draw);
  visibility.addEventListener('change', draw);
  draw();
}

function eventCard(e) {
  return h('a.row-card', { href: `#/events/${e.id}` }, [
    h('div.cover', { style: { backgroundImage: e.coverImage ? `url("${e.coverImage.replace(/"/g, '%22')}")` : '' } }, [
      h('div.badges', {}, [
        e.isPublished ? h('span.badge.live', {}, 'Published') : h('span.badge.draft', {}, 'Draft'),
        h('span.badge', {}, (STATUSES.find(([v]) => v === e.status) || [, e.status])[1])
      ])
    ]),
    h('div.body', {}, [
      h('h3', {}, e.title),
      h('p', {}, [formatDate(e.startDate) || e.date, e.venue, e.mediaCount !== undefined ? `${e.mediaCount} media` : null].filter(Boolean).join(' · '))
    ])
  ]);
}

function newEvent() {
  const m = openModal('New event', { small: true });
  const title = h('input', { type: 'text', required: true, maxlength: '120' });
  const venue = h('input', { type: 'text', required: true, maxlength: '120' });
  const start = h('input', { type: 'date' });
  const error = h('p.form-error');
  const create = h('button.btn.btn-primary', { type: 'button' }, 'Create');

  m.body.append(h('div.stack', {}, [field('Title', title), field('Venue', venue), field('Start date', start), error]));
  m.foot.append(h('button.btn.btn-ghost', { type: 'button', onclick: () => m.close() }, 'Cancel'), create);
  title.focus();

  create.addEventListener('click', async () => {
    if (title.value.trim().length < 2) { error.textContent = 'Give the event a title.'; return; }
    if (!venue.value.trim()) { error.textContent = 'Add a venue.'; return; }
    create.disabled = true;
    try {
      const res = await api('/api/events', {
        method: 'POST',
        body: {
          title: title.value.trim(),
          venue: venue.value.trim(),
          startDate: start.value || undefined,
          date: start.value || undefined,
          isPublished: false
        }
      });
      invalidateLookups();
      m.close();
      location.hash = `#/events/${res.data.id}`;
    } catch (err) {
      error.textContent = err.message;
      create.disabled = false;
    }
  });
}

export async function renderEventEditor(view, id) {
  view.replaceChildren(h('div.spinner', {}, 'Loading…'));
  let ev;
  try {
    ev = (await api(`/api/events/${encodeURIComponent(id)}`)).data;
  } catch (err) {
    view.replaceChildren(h('a.crumb', { href: '#/events' }, '← Events'), h('div.empty', {}, err.status === 404 ? 'Event not found.' : err.message));
    return;
  }

  const dateOnly = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');

  const title = h('input', { type: 'text', value: ev.title, maxlength: '120' });
  const slug = h('input', { type: 'text', value: ev.slug || '', maxlength: '80', pattern: '[a-z0-9-]+' });
  const venue = h('input', { type: 'text', value: ev.venue || '', maxlength: '120' });
  const start = h('input', { type: 'date', value: dateOnly(ev.startDate) });
  const end = h('input', { type: 'date', value: dateOnly(ev.endDate) });
  const status = select(STATUSES, ev.status);
  const summary = h('input', { type: 'text', value: ev.summary || '', maxlength: '300', placeholder: 'One line shown on the events list' });
  const description = h('textarea', { rows: 6, placeholder: 'The story of the event, shown on its page' }, ev.description || '');
  const published = h('input', { type: 'checkbox', checked: ev.isPublished });
  const sortOrder = h('input', { type: 'number', value: String(ev.sortOrder || 0), step: '1' });
  const heroSel = select([['', 'None']], '');
  let cover = ev.coverImage && !ev.coverImage.includes('images.unsplash.com') ? ev.coverImage : null;

  const save = h('button.btn.btn-primary', { type: 'button' }, 'Save changes');
  const del = h('button.btn.btn-danger', { type: 'button' }, 'Delete event');
  let hero = ev.heroVideoId || '';
  heroSel.addEventListener('change', () => { hero = heroSel.value; });

  async function refreshHeroOptions() {
    try {
      const res = await api('/api/media', { query: { eventId: ev.id, type: 'video', status: 'all', limit: 200 } });
      heroSel.replaceChildren(...[['', 'None'], ...res.data.map(v => [v.id, v.title])].map(([v, l]) =>
        h('option', { value: v, selected: v === hero }, l)));
    } catch (e) { /* keep existing options */ }
  }

  const browser = createMediaBrowser({
    query: { eventId: ev.id },
    controls: ['search', 'type', 'status'],
    sortable: true,
    emptyText: 'No photos or videos linked to this event yet.',
    onChange: refreshHeroOptions,
    extraBulk: (ids, run) => h('button.btn.btn-sm', { type: 'button', onclick: () => run('move', { eventId: null }) }, 'Remove from event')
  });

  const uploadCategory = select([['', 'Auto (photos → Photography, videos → Videography)'], ['photography', 'Photography'], ['videography', 'Videography'], ['sports', 'Sports'], ['team-bts', 'Team BTS'], ['reels', 'Reels']], '', { 'aria-label': 'Category for uploads' });
  uploadCategory.style.width = 'auto';
  const uploader = createUploader({
    fields: () => ({ eventId: ev.id, category: uploadCategory.value }),
    extraOptions: field('Gallery category', uploadCategory),
    onUploaded: (items) => { browser.prepend(items); refreshHeroOptions(); }
  });

  const attach = h('button.btn', {
    type: 'button',
    onclick: async () => {
      const items = await pickMedia({ title: 'Add existing media to this event', multiple: true });
      if (!items.length) return;
      try {
        await api('/api/media/bulk', { method: 'PATCH', body: { ids: items.map(i => i.id), action: 'move', eventId: ev.id } });
        toast(`${items.length} item${items.length > 1 ? 's' : ''} added`);
        browser.reload();
        refreshHeroOptions();
      } catch (err) { fail(err); }
    }
  }, 'Add from library');

  view.replaceChildren(
    h('a.crumb', { href: '#/events' }, '← Events'),
    h('div.page-head', {}, [
      h('div', {}, [h('h1', {}, ev.title), h('p', {}, ev.isPublished ? 'Published' : 'Draft · not visible on the site')]),
      save
    ]),
    h('section.panel', {}, [
      h('h2', {}, 'Details'),
      h('div.form-grid', {}, [
        field('Title', title),
        field('Page address', slug, 'Lowercase letters, numbers and dashes. Leave as is unless you need to change the link.'),
        field('Venue', venue),
        field('Status', status),
        field('Start date', start),
        field('End date', end),
        h('div.span-2', {}, [field('Summary', summary)]),
        h('div.span-2', {}, [field('Description', description)])
      ])
    ]),
    h('section.panel', {}, [
      h('h2', {}, 'Cover & featured film'),
      h('div.stack', {}, [
        field('Cover image', imageField({ value: cover, onChange: (url) => { cover = url; } })),
        field('Featured video', heroSel, 'Plays at the top of the event page. Choose from videos linked below.')
      ])
    ]),
    h('section.panel', {}, [
      h('h2', {}, 'Publishing'),
      h('div.form-grid', {}, [
        h('label.check', {}, [published, 'Published (visible on the site)']),
        field('List position', sortOrder, 'Lower numbers appear first on the events page.')
      ])
    ]),
    h('section.panel', {}, [
      h('div.panel-head', {}, [h('h2', {}, 'Photos & videos'), attach]),
      uploader
    ]),
    h('section.panel', {}, [browser.el]),
    h('div.chips', {}, [del])
  );

  refreshHeroOptions();

  save.addEventListener('click', async () => {
    if (title.value.trim().length < 2) return toast('Title is too short', 'error');
    if (slug.value && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value)) return toast('Page address can only use lowercase letters, numbers and dashes', 'error');
    save.disabled = true;
    try {
      const body = {
        title: title.value.trim(),
        venue: venue.value.trim(),
        status: status.value,
        // Empty string clears the date server-side
        startDate: start.value,
        endDate: end.value,
        date: start.value || undefined,
        summary: summary.value.trim() || null,
        description: description.value.trim(),
        isPublished: published.checked,
        heroVideoId: heroSel.value || null,
        sortOrder: parseInt(sortOrder.value, 10) || 0
      };
      if (cover) body.coverImage = cover;
      if (slug.value && slug.value !== ev.slug) body.slug = slug.value;

      const res = await api(`/api/events/${ev.id}`, { method: 'PATCH', body });
      ev = { ...ev, ...res.data };
      slug.value = ev.slug || '';
      view.querySelector('.page-head h1').textContent = ev.title;
      view.querySelector('.page-head p').textContent = ev.isPublished ? 'Published' : 'Draft · not visible on the site';
      invalidateLookups();
      toast('Event saved');
    } catch (err) {
      fail(err);
    } finally {
      save.disabled = false;
    }
  });

  del.addEventListener('click', async () => {
    if (!(await confirmDialog(`Delete "${ev.title}"? Its photos and videos stay in the library, unlinked from the event.`))) return;
    try {
      await api(`/api/events/${ev.id}`, { method: 'DELETE' });
      invalidateLookups();
      toast('Event deleted');
      location.hash = '#/events';
    } catch (err) { fail(err); }
  });
}
