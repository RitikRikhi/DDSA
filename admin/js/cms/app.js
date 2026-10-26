// Admin panel entry: login, session check and hash routing.
import { api, auth } from './api.js';
import { h, fail } from './ui.js';
import { renderGallery } from './gallery.js';
import { renderEvents, renderEventEditor } from './events.js';
import { renderVideography } from './videography.js';
import { renderTeam, renderMemberEditor } from './team.js';
import { renderLibrary } from './library.js';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

const loginView = document.getElementById('loginView');
const appView = document.getElementById('appView');
const view = document.getElementById('view');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

let currentUser = null;

function showLogin(message = '') {
  currentUser = null;
  appView.hidden = true;
  loginView.hidden = false;
  loginError.textContent = message;
  loginForm.querySelector('input[name="email"]').focus();
}

async function startSession() {
  if (!auth.token) return showLogin();
  try {
    const { user } = await api('/api/auth/me');
    if (!ADMIN_ROLES.includes(user.roleKey)) {
      auth.clear();
      return showLogin('This account doesn\'t have admin access.');
    }
    currentUser = user;
    document.getElementById('whoami').replaceChildren(h('strong', {}, user.name), user.email);
    loginView.hidden = true;
    appView.hidden = false;
    route();
  } catch (err) {
    auth.clear();
    showLogin(err.status === 401 ? 'Your session expired. Please sign in again.' : err.message);
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(loginForm);
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  if (!email || !password) {
    loginError.textContent = 'Enter your email and password.';
    return;
  }
  const btn = loginForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  loginError.textContent = '';
  try {
    const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    auth.set(res.token);
    loginForm.reset();
    await startSession();
  } catch (err) {
    loginError.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* token is dropped either way */ }
  auth.clear();
  showLogin();
});

window.addEventListener('cms:unauthorized', () => {
  if (currentUser) showLogin('Your session expired. Please sign in again.');
});

// ---------- Routing ----------
const routes = [
  { pattern: /^\/gallery$/, section: 'gallery', render: (p) => renderGallery(view, p) },
  { pattern: /^\/events$/, section: 'events', render: () => renderEvents(view) },
  { pattern: /^\/events\/([^/]+)$/, section: 'events', render: (p, m) => renderEventEditor(view, decodeURIComponent(m[1])) },
  { pattern: /^\/videography$/, section: 'videography', render: () => renderVideography(view) },
  { pattern: /^\/team$/, section: 'team', render: (p) => renderTeam(view, p) },
  { pattern: /^\/team\/([^/]+)$/, section: 'team', render: (p, m) => renderMemberEditor(view, decodeURIComponent(m[1])) },
  { pattern: /^\/library$/, section: 'library', render: () => renderLibrary(view) }
];

function route() {
  if (!currentUser) return;
  const raw = location.hash.replace(/^#/, '') || '/gallery';
  const [path, qs = ''] = raw.split('?');
  const params = new URLSearchParams(qs);

  const match = routes.map(r => ({ r, m: path.match(r.pattern) })).find(x => x.m);
  if (!match) {
    location.replace('#/gallery');
    return;
  }

  document.querySelectorAll('.nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.section === match.r.section);
  });

  // Close any drawer or modal left open by the previous view
  document.querySelectorAll('.overlay').forEach(o => o.remove());

  try {
    const result = match.r.render(params, match.m);
    if (result && typeof result.catch === 'function') result.catch(fail);
  } catch (err) {
    fail(err);
  }
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
startSession();
