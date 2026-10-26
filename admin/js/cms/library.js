// Media Library: every asset across categories, including internal site assets.
import { h, select } from './ui.js';
import { createUploader, createMediaBrowser, ALL_CATEGORIES } from './media.js';

export function renderLibrary(view) {
  const target = select(ALL_CATEGORIES, 'photography', { 'aria-label': 'Upload to category' });
  target.style.width = 'auto';

  const browser = createMediaBrowser({
    query: {},
    controls: ['search', 'category', 'type', 'status']
  });

  const uploader = createUploader({
    fields: () => ({ category: target.value }),
    extraOptions: h('label.check', {}, ['Category ', target]),
    onUploaded: () => browser.reload()
  });

  view.replaceChildren(
    h('div.page-head', {}, [h('div', {}, [
      h('h1', {}, 'Media Library'),
      h('p', {}, 'Every uploaded file in one place, including covers, posters and avatars (the "Site assets" category). Select several to publish, move or delete them together.')
    ])]),
    h('section.panel', {}, [h('h2', {}, 'Upload'), uploader]),
    h('section.panel', {}, [browser.el])
  );
}
