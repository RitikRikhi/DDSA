// Videography: films shown on the Videography / Aftermovies page.
import { h, select, field } from './ui.js';
import { VIDEO_SUBCATEGORIES, ACCEPT, createUploader, createMediaBrowser } from './media.js';

export function renderVideography(view) {
  const subSelect = select([['', 'Choose type (optional)'], ...VIDEO_SUBCATEGORIES], '');
  subSelect.style.width = 'auto';

  const browser = createMediaBrowser({
    query: { category: 'videography' },
    controls: ['search', 'subcategory', 'type', 'status'],
    sortable: true,
    emptyText: 'No films yet. Upload an aftermovie or reel above.'
  });

  const uploader = createUploader({
    label: 'Drop videos here, or click to choose',
    accept: ACCEPT.any,
    fields: () => ({ category: 'videography', subcategory: subSelect.value }),
    extraOptions: field('Type', subSelect),
    onUploaded: (items) => browser.prepend(items)
  });

  view.replaceChildren(
    h('div.page-head', {}, [h('div', {}, [
      h('h1', {}, 'Videography'),
      h('p', {}, 'Aftermovies, highlights and reels. A poster frame is generated automatically; open a video to replace it, credit the crew, or link it to an event.')
    ])]),
    h('section.panel', {}, [h('h2', {}, 'Upload films'), uploader]),
    h('section.panel', {}, [h('div.panel-head', {}, [h('h2', {}, 'Films')]), browser.el])
  );
}
