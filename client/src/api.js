const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

let token = null;
try {
  token = localStorage.getItem('vsk.token');
} catch {
  /* storage unavailable */
}

export function setToken(t) {
  token = t;
  try {
    if (t) localStorage.setItem('vsk.token', t);
    else localStorage.removeItem('vsk.token');
  } catch {
    /* storage unavailable */
  }
}

export const getToken = () => token;

export class ApiError extends Error {
  constructor(status, code, details) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) });
  } catch {
    throw new ApiError(0, 'offline');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('vsk:logout'));
  }
  if (!res.ok) throw new ApiError(res.status, data.error || 'generic', data.details);
  return data;
}

/** Authenticated file URL (opened in a new tab via blob, since <a href> cannot send the token). */
export async function openFile(path) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError(res.status, 'generic');
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
}

/** Download an authenticated file (Excel exports) with its name. */
export async function downloadFile(path, filename) {
  let res;
  try {
    res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError(0, 'offline');
  }
  if (!res.ok) throw new ApiError(res.status, 'generic');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
