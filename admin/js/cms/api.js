// API client for the admin panel. Token lives in sessionStorage so closing
// the browser signs the admin out.

const TOKEN_KEY = 'dsa_cms_token';

export const auth = {
  get token() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  },
  set(token) {
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e) { /* private mode */ }
  },
  clear() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* private mode */ }
  }
};

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function handleUnauthorized() {
  auth.clear();
  window.dispatchEvent(new CustomEvent('cms:unauthorized'));
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }

  const headers = { Accept: 'application/json' };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }

  if (res.status === 401 && path !== '/api/auth/login') handleUnauthorized();
  if (!res.ok) {
    throw new ApiError(data?.message || data?.error || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

/**
 * Upload one file with progress. fields are sent as form fields.
 * Resolves with the created media item.
 */
export function uploadFile(file, fields = {}, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== null && v !== '') form.append(k, v);
    }
    form.append('media', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media/upload');
    if (auth.token) xhr.setRequestHeader('Authorization', `Bearer ${auth.token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) { /* non-JSON error page */ }
      if (xhr.status === 401) handleUnauthorized();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data.file || data.data);
      } else {
        const msg = data?.message
          || (xhr.status === 413 ? 'File too large for the server' : `Upload failed (${xhr.status})`);
        reject(new ApiError(msg, xhr.status, data));
      }
    };
    xhr.onerror = () => reject(new ApiError('Network error during upload', 0));
    xhr.send(form);
  });
}
