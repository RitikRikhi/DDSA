// Gallery: one tab per public gallery category, upload + reorder per tab.
import { api } from './api.js';
import { h } from './ui.js';
import { GALLERY_CATEGORIES, createUploader, createMediaBrowser } from './media.js';

export function renderGallery(view, params) {
  const current = GALLERY_CATEGORIES.some(([v]) => v === params.get('category')) ? params.get('category') : 'photography';
  const label = GALLERY_CATEGORIES.find(([v]) => v === current)[1];

  const tabs = h('div.tabs', { role: 'tablist' }, GALLERY_CATEGORIES.map(([value, name]) => h('a.tab', {
    href: `#/gallery?category=${value}`,
    role: 'tab',
    'aria-selected': String(value === current),
    class: value === current ? 'active' : '',
    dataset: { cat: value }
  }, [name, h('span.count')])));

  const browser = createMediaBrowser({
    query: { category: current },
    controls: ['search', 'type', 'status'],
    sortable: true,
    emptyText: `No ${label.toLowerCase()} yet. Upload above.`,
    onChange: refreshCounts
  });

  const uploader = createUploader({
    label: `Drop ${label.toLowerCase()} photos or videos here, or click to choose`,
    fields: () => ({ category: current }),
    onUploaded: (items) => { browser.prepend(items); refreshCounts(); }
  });

  view.replaceChildren(
    h('div.page-head', {}, [h('div', {}, [
      h('h1', {}, 'Gallery'),
      h('p', {}, 'Everything on the public Gallery page, by category. Drafts stay hidden until published; drag cards to set the order shown on the site.')
    ])]),
    tabs,
    h('section.panel', {}, [h('h2', {}, `Upload to ${label}`), uploader]),
    h('section.panel', {}, [h('div.panel-head', {}, [h('h2', {}, label)]), browser.el])
  );

  async function refreshCounts() {
    // One small request per category; limit=1 just to read totals
    await Promise.all(GALLERY_CATEGORIES.map(async ([value]) => {
      try {
        const res = await api('/api/media', { query: { category: value, status: 'all', limit: 1 } });
        const el = tabs.querySelector(`[data-cat="${value}"] .count`);
        if (el) el.textContent = res.total;
      } catch (e) { /* counts are cosmetic */ }
    }));
  }
  refreshCounts();
}
