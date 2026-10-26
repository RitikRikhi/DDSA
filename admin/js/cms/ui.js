// Small DOM helpers shared by every admin section.

/**
 * h('div.card', { onclick }, [children]) — creates an element.
 * Strings become text nodes, so user content is never parsed as HTML.
 */
export function h(tag, attrs = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'class') {
      el.className += (el.className ? ' ' : '') + value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key in el && typeof value !== 'string') {
      el[key] = value;
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, value);
    }
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function toast(message, type = 'success') {
  const box = document.getElementById('toasts');
  const el = h('div.toast', { class: type === 'error' ? 'error' : '' }, message);
  box.append(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3000);
}

export function fail(err) {
  console.error(err);
  toast(err?.message || 'Something went wrong', 'error');
}

/** Right-side drawer. Returns { el, close }. */
export function openDrawer(build) {
  const drawer = h('aside.drawer', { role: 'dialog', 'aria-modal': 'true' });
  const overlay = h('div.overlay', {}, [drawer]);
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  // Esc closes the drawer only when no modal is open on top of it
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.overlay.center')) close(); };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  build(drawer, close);
  document.body.append(overlay);
  drawer.querySelector('input, select, textarea, button')?.focus();
  return { el: drawer, close };
}

/** Centered modal with head/body/foot. Returns { body, foot, close }. */
export function openModal(title, { small = false } = {}) {
  const body = h('div.modal-body');
  const foot = h('div.modal-foot');
  let close;
  const closeBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Close', onclick: () => close() }, '✕');
  const modal = h('div.modal', { role: 'dialog', 'aria-modal': 'true', class: small ? 'small' : '' }, [
    h('div.modal-head', {}, [h('h2', {}, title), closeBtn]),
    body,
    foot
  ]);
  const overlay = h('div.overlay.center', {}, [modal]);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  return { body, foot, close };
}

export function confirmDialog(message, { confirmLabel = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    const m = openModal('Are you sure?', { small: true });
    m.body.append(h('p', {}, message));
    const done = (v) => { m.close(); resolve(v); };
    m.foot.append(
      h('button.btn.btn-ghost', { type: 'button', onclick: () => done(false) }, 'Cancel'),
      h('button.btn', { type: 'button', class: danger ? 'btn-danger' : 'btn-primary', onclick: () => done(true) }, confirmLabel)
    );
    m.foot.lastChild.focus();
  });
}

export function field(label, input, hint) {
  return h('label.field', {}, [h('span', {}, label), input, hint ? h('small', {}, hint) : null]);
}

export function select(options, value, attrs = {}) {
  return h('select', attrs, options.map(([v, label]) =>
    h('option', { value: v, selected: v === value }, label)));
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDuration(sec) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Make children of `container` matching `selector` drag-sortable.
 * Calls onSort(orderedIds) after a drop. Items need data-id.
 */
export function makeSortable(container, selector, onSort) {
  let dragged = null;

  container.addEventListener('dragstart', (e) => {
    const item = e.target.closest(selector);
    // Links are natively draggable; only explicitly enabled items take part
    if (!item || !container.contains(item) || item.getAttribute('draggable') !== 'true') return;
    dragged = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id);
  });

  container.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const over = e.target.closest(selector);
    if (!over || over === dragged) return;
    const rect = over.getBoundingClientRect();
    const horizontal = getComputedStyle(container).display === 'grid' && rect.width < container.clientWidth * 0.8;
    const after = horizontal
      ? e.clientX > rect.left + rect.width / 2
      : e.clientY > rect.top + rect.height / 2;
    over.parentNode.insertBefore(dragged, after ? over.nextSibling : over);
  });

  container.addEventListener('dragend', () => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged = null;
    onSort([...container.querySelectorAll(selector)].map(el => el.dataset.id));
  });
}
