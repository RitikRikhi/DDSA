// Team Portfolio: member profiles (everything the portfolio page shows) and
// the work credited to each member.
import { api } from './api.js';
import { h, toast, fail, openModal, confirmDialog, field, select, makeSortable } from './ui.js';
import { createUploader, imageField, pickMedia, mediaThumb, ALL_CATEGORIES, invalidateLookups } from './media.js';

export const TEAM_CATEGORIES = [
  ['leader', 'Leadership'],
  ['photography', 'Photography'],
  ['videography', 'Videography'],
  ['design', 'Design'],
  ['editing', 'Editing'],
  ['content', 'Content'],
  ['tech', 'Tech'],
  ['vlogging', 'Vlogging'],
  ['onscreen', 'On Screen']
];
const teamCategoryLabel = (v) => (TEAM_CATEGORIES.find(([k]) => k === v) || [, 'No team'])[1];

const SOCIALS = ['instagram', 'linkedin', 'youtube', 'behance', 'github'];
const DNA_KEYS = ['storytelling', 'cinematography', 'editing', 'creativity', 'leadership'];

export async function renderTeam(view, params) {
  const visibility = select([['all', 'Everyone'], ['public', 'Shown on site'], ['hidden', 'Hidden']], params.get('visibility') || 'all', { 'aria-label': 'Visibility' });
  const teamSel = select([['all', 'All teams'], ...TEAM_CATEGORIES], 'all', { 'aria-label': 'Team' });
  const search = h('input', { type: 'search', placeholder: 'Search name or title', class: 'grow' });
  const hint = h('span.hint');
  [visibility, teamSel].forEach(s => { s.style.width = 'auto'; });
  const list = h('div.member-list', {}, [h('div.spinner', {}, 'Loading…')]);

  view.replaceChildren(
    h('div.page-head', {}, [
      h('div', {}, [h('h1', {}, 'Team Portfolio'), h('p', {}, 'Profiles shown on the Team page and each member\'s portfolio page. Only members marked "Shown on site" appear publicly.')]),
      h('button.btn.btn-primary', { type: 'button', onclick: newMember }, '+ New member')
    ]),
    h('div.toolbar', {}, [search, visibility, teamSel, hint]),
    list
  );

  let members = [];
  const canSort = () => visibility.value === 'public' && teamSel.value === 'all' && !search.value.trim();

  async function load() {
    list.replaceChildren(h('div.spinner', {}, 'Loading…'));
    try {
      const res = await api('/api/team/manage', { query: { visibility: visibility.value, teamCategory: teamSel.value, search: search.value.trim() } });
      members = res.data;
      draw();
    } catch (err) {
      list.replaceChildren(h('div.empty', {}, `Couldn't load members: ${err.message}`));
    }
  }

  function draw() {
    const sortable = canSort();
    hint.textContent = `${members.length} member${members.length === 1 ? '' : 's'}` +
      (sortable ? ' · drag to set the order on the Team page' : (visibility.value === 'public' ? '' : ' · show "Shown on site" to reorder'));
    if (!members.length) {
      list.replaceChildren(h('div.empty', {}, 'No members match.'));
      return;
    }
    list.replaceChildren(...members.map(m => h('a.member-row', { href: `#/team/${m.id}`, dataset: { id: m.id }, draggable: sortable }, [
      h('span.grip', { 'aria-hidden': 'true' }, sortable ? '⋮⋮' : ''),
      m.avatar ? h('img', { src: m.avatar, alt: '', loading: 'lazy' }) : h('div.avatar-ph'),
      h('div.who', {}, [
        h('strong', {}, m.name),
        h('span', {}, [m.displayRole || m.accessRole, teamCategoryLabel(m.teamCategory)].filter(Boolean).join(' · '))
      ]),
      h('div.chips', {}, [
        m.portfolioCount ? h('span.badge', {}, `${m.portfolioCount} works`) : null,
        m.isPublic ? h('span.badge.live', {}, 'On site') : h('span.badge', {}, 'Hidden')
      ])
    ])));
  }

  makeSortable(list, '.member-row', async (ids) => {
    if (!canSort()) return;
    try {
      await api('/api/team/reorder', { method: 'PATCH', body: { items: ids.map((id, i) => ({ id, displayOrder: i + 1 })) } });
      toast('Order saved');
    } catch (err) { fail(err); load(); }
  });

  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 300); });
  visibility.addEventListener('change', load);
  teamSel.addEventListener('change', load);
  load();
}

function newMember() {
  const m = openModal('New member', { small: true });
  const name = h('input', { type: 'text', maxlength: '100' });
  const role = h('input', { type: 'text', maxlength: '80', placeholder: 'e.g. Lead Photographer' });
  const team = select([['', 'Choose team'], ...TEAM_CATEGORIES], '');
  const error = h('p.form-error');
  const create = h('button.btn.btn-primary', { type: 'button' }, 'Create');
  m.body.append(h('div.stack', {}, [field('Name', name), field('Title', role), field('Team', team), error]));
  m.foot.append(h('button.btn.btn-ghost', { type: 'button', onclick: () => m.close() }, 'Cancel'), create);
  name.focus();

  create.addEventListener('click', async () => {
    if (name.value.trim().length < 2) { error.textContent = 'Enter the member\'s name.'; return; }
    create.disabled = true;
    try {
      const res = await api('/api/team', {
        method: 'POST',
        body: { name: name.value.trim(), displayRole: role.value.trim() || null, teamCategory: team.value || null, isPublic: false }
      });
      invalidateLookups();
      m.close();
      location.hash = `#/team/${res.data.id}`;
    } catch (err) {
      error.textContent = err.message;
      create.disabled = false;
    }
  });
}

export async function renderMemberEditor(view, id) {
  view.replaceChildren(h('div.spinner', {}, 'Loading…'));
  let member;
  try {
    member = (await api(`/api/team/manage/${encodeURIComponent(id)}`)).data;
  } catch (err) {
    view.replaceChildren(h('a.crumb', { href: '#/team' }, '← Team'), h('div.empty', {}, err.status === 404 ? 'Member not found.' : err.message));
    return;
  }

  // ----- Profile fields -----
  const name = h('input', { type: 'text', value: member.name, maxlength: '100' });
  const displayRole = h('input', { type: 'text', value: member.displayRole || '', maxlength: '80', placeholder: 'e.g. Vice President' });
  const teamCategory = select([['', 'No team'], ...TEAM_CATEGORIES], member.teamCategory || '');
  const year = h('input', { type: 'text', value: member.year || '', maxlength: '30', placeholder: 'e.g. 3rd Year' });
  const slug = h('input', { type: 'text', value: member.slug || '', maxlength: '80' });
  const tagline = h('input', { type: 'text', value: member.tagline, maxlength: '200', placeholder: 'One line under their name' });
  const specialty = h('input', { type: 'text', value: member.specialty, maxlength: '200', placeholder: 'e.g. PORTRAITURE / EDITORIAL' });
  const bio = h('textarea', { rows: 5, maxlength: '3000' }, member.bio);
  const isPublic = h('input', { type: 'checkbox', checked: member.isPublic });
  const credits = h('textarea', { rows: 4, placeholder: 'One project per line, e.g. Meraki 2026' }, (member.credits || []).join('\n'));

  let avatar = member.avatar || null;
  let banner = member.bannerImage || null;

  // Skills as chips
  const skills = [...(member.skills || [])];
  const skillInput = h('input', { type: 'text', placeholder: 'Type a skill and press Enter' });
  const skillBox = h('div.chips');
  const drawSkills = () => {
    skillBox.replaceChildren(...skills.map((s, i) => h('span.chip', {}, [s, h('button', {
      type: 'button', 'aria-label': `Remove ${s}`, onclick: () => { skills.splice(i, 1); drawSkills(); }
    }, '×')])), skillInput);
  };
  skillInput.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',') && skillInput.value.trim()) {
      e.preventDefault();
      const v = skillInput.value.trim();
      if (!skills.includes(v)) skills.push(v);
      skillInput.value = '';
      drawSkills();
      skillInput.focus();
    }
  });
  drawSkills();

  // Socials
  const socialInputs = Object.fromEntries(SOCIALS.map(k => [k, h('input', { type: 'url', value: member.socials?.[k] || '', placeholder: 'https://' })]));

  // Media DNA sliders
  const dnaKeys = [...new Set([...DNA_KEYS, ...Object.keys(member.mediaDNA || {})])];
  const dnaInputs = {};
  const dnaRows = dnaKeys.map(k => {
    const out = h('output', {}, String(member.mediaDNA?.[k] ?? 0));
    const input = h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(member.mediaDNA?.[k] ?? 0), 'aria-label': k });
    input.addEventListener('input', () => { out.textContent = input.value; });
    dnaInputs[k] = input;
    return h('div.slider-row', {}, [h('span', {}, k[0].toUpperCase() + k.slice(1)), input, out]);
  });

  const save = h('button.btn.btn-primary', { type: 'button' }, 'Save profile');
  const del = h('button.btn.btn-danger', { type: 'button' }, 'Delete member');

  // ----- Portfolio -----
  const portfolio = (member.portfolio || []).map(p => ({ item: p, role: p.creditRole || '' }));
  const portfolioGrid = h('div.media-grid');
  const savePortfolio = h('button.btn.btn-primary', { type: 'button' }, 'Save portfolio');
  const portfolioHint = h('span.hint');

  const drawPortfolio = () => {
    portfolioHint.textContent = `${portfolio.length} item${portfolio.length === 1 ? '' : 's'}`;
    if (!portfolio.length) {
      portfolioGrid.replaceChildren(h('div.empty', { style: { gridColumn: '1 / -1' } }, 'No work credited yet. Add from the library or upload new work.'));
      return;
    }
    portfolioGrid.replaceChildren(...portfolio.map((p, i) => h('div.card', {}, [
      h('div.thumb', {}, [mediaThumb(p.item), h('div.badges', {}, [
        p.item.isPublished ? null : h('span.badge.draft', {}, 'Draft'),
        p.item.type === 'video' ? h('span.badge.vid', {}, 'Video') : null
      ])]),
      h('div.meta', {}, [
        h('div.title', { title: p.item.title }, p.item.title),
        h('input', { type: 'text', value: p.role, placeholder: 'Their role', 'aria-label': 'Role on this work', style: { marginTop: '6px', padding: '6px 8px', fontSize: '12px' }, oninput: (e) => { p.role = e.target.value; } }),
        h('div.actions', {}, [h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: () => { portfolio.splice(i, 1); drawPortfolio(); } }, 'Remove')])
      ])
    ])));
  };
  drawPortfolio();

  const addFromLibrary = h('button.btn', {
    type: 'button',
    onclick: async () => {
      const items = await pickMedia({ title: `Add work to ${member.name}'s portfolio`, multiple: true, exclude: new Set(portfolio.map(p => p.item.id)) });
      items.forEach(item => portfolio.push({ item, role: '' }));
      if (items.length) { drawPortfolio(); toast('Added. Save portfolio to keep the changes.'); }
    }
  }, 'Add from library');

  const uploadCategory = select(ALL_CATEGORIES.filter(([v]) => v !== 'site'), 'photography', { 'aria-label': 'Category' });
  uploadCategory.style.width = 'auto';
  const uploader = createUploader({
    label: 'Upload new work for this member',
    fields: () => ({ category: uploadCategory.value }),
    extraOptions: field('Category', uploadCategory),
    onUploaded: (items) => {
      items.forEach(item => portfolio.push({ item, role: '' }));
      drawPortfolio();
      persistPortfolio();
    }
  });

  async function persistPortfolio() {
    savePortfolio.disabled = true;
    try {
      await api(`/api/team/${member.id}/portfolio`, {
        method: 'PUT',
        body: { items: portfolio.map(p => ({ mediaId: p.item.id, role: p.role.trim() || null })) }
      });
      toast('Portfolio saved');
    } catch (err) { fail(err); } finally { savePortfolio.disabled = false; }
  }
  savePortfolio.addEventListener('click', persistPortfolio);

  view.replaceChildren(
    h('a.crumb', { href: '#/team' }, '← Team'),
    h('div.page-head', {}, [
      h('div', {}, [h('h1', {}, member.name), h('p', {}, member.isPublic ? 'Shown on site' : 'Hidden from site')]),
      save
    ]),
    h('section.panel', {}, [
      h('h2', {}, 'Profile'),
      h('div.form-grid', {}, [
        field('Name', name),
        field('Title', displayRole, 'Shown on their card and portfolio.'),
        field('Team', teamCategory),
        field('Year', year),
        field('Tagline', tagline),
        field('Specialty', specialty),
        h('div.span-2', {}, [field('Bio', bio)]),
        h('div.span-2', {}, [field('Portfolio address', slug, 'Lowercase letters, numbers and dashes.')])
      ])
    ]),
    h('section.panel', {}, [
      h('h2', {}, 'Photos'),
      h('div.form-grid', {}, [
        field('Profile photo', imageField({ value: avatar, round: true, onChange: (url) => { avatar = url; } })),
        field('Banner', imageField({ value: banner, onChange: (url) => { banner = url; } }))
      ])
    ]),
    h('section.panel', {}, [
      h('h2', {}, 'Skills & credits'),
      h('div.stack', {}, [
        h('div.field', {}, [h('span', {}, 'Skills'), skillBox]),
        field('Credits', credits)
      ])
    ]),
    h('section.panel', {}, [
      h('h2', {}, 'Media DNA'),
      h('div.stack', {}, dnaRows)
    ]),
    h('section.panel', {}, [
      h('h2', {}, 'Social links'),
      h('div.form-grid', {}, SOCIALS.map(k => field(k[0].toUpperCase() + k.slice(1), socialInputs[k])))
    ]),
    h('section.panel', {}, [
      h('h2', {}, 'Visibility'),
      h('label.check', {}, [isPublic, 'Show on the Team page and give them a portfolio page'])
    ]),
    h('section.panel', {}, [
      h('div.panel-head', {}, [h('h2', {}, 'Portfolio'), h('div.chips', {}, [portfolioHint, addFromLibrary, savePortfolio])]),
      portfolioGrid
    ]),
    h('section.panel', {}, [h('h2', {}, 'Upload new work'), uploader]),
    h('div.chips', {}, [del])
  );

  save.addEventListener('click', async () => {
    if (name.value.trim().length < 2) return toast('Name is too short', 'error');
    if (slug.value && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value)) return toast('Portfolio address can only use lowercase letters, numbers and dashes', 'error');
    const socials = {};
    for (const k of SOCIALS) {
      const v = socialInputs[k].value.trim();
      if (!v) continue;
      if (!/^https?:\/\//i.test(v)) return toast(`${k} link must start with http:// or https://`, 'error');
      socials[k] = v;
    }
    save.disabled = true;
    try {
      const body = {
        name: name.value.trim(),
        displayRole: displayRole.value.trim() || null,
        teamCategory: teamCategory.value || null,
        year: year.value.trim() || null,
        tagline: tagline.value.trim() || null,
        specialty: specialty.value.trim() || null,
        bio: bio.value.trim() || null,
        skills,
        credits: credits.value.split('\n').map(s => s.trim()).filter(Boolean),
        socials,
        mediaDNA: Object.fromEntries(Object.entries(dnaInputs).map(([k, el]) => [k, parseInt(el.value, 10) || 0])),
        avatar,
        bannerImage: banner,
        isPublic: isPublic.checked
      };
      if (slug.value && slug.value !== member.slug) body.slug = slug.value;
      const res = await api(`/api/team/${member.id}`, { method: 'PUT', body });
      member = { ...member, ...res.data };
      slug.value = member.slug || '';
      view.querySelector('.page-head h1').textContent = member.name;
      view.querySelector('.page-head p').textContent = member.isPublic ? 'Shown on site' : 'Hidden from site';
      invalidateLookups();
      toast('Profile saved');
    } catch (err) {
      fail(err);
    } finally {
      save.disabled = false;
    }
  });

  del.addEventListener('click', async () => {
    if (!(await confirmDialog(`Delete ${member.name}'s profile? Their credited work stays in the library.`))) return;
    try {
      await api(`/api/team/${member.id}`, { method: 'DELETE' });
      invalidateLookups();
      toast('Member deleted');
      location.hash = '#/team';
    } catch (err) { fail(err); }
  });
}
