// Optional cloud sync for review progress (see functions/api/state.js).
// Without a token configured the site behaves exactly as before, local-only.
// Whole-blob, last-write-wins: fine for one person on two devices.

const TOKEN_KEY = 'kaiwa-note:sync-token';
const STAMP_KEY = 'kaiwa-note:updated-at';
const DATA_KEYS = ['kaiwa-note:srs:v1', 'kaiwa-note:meta:v1'];

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function touch() {
  localStorage.setItem(STAMP_KEY, String(Date.now()));
}

function collect() {
  const data = { updatedAt: Number(localStorage.getItem(STAMP_KEY)) || 0 };
  for (const key of DATA_KEYS) data[key] = localStorage.getItem(key);
  return data;
}

async function call(method, body) {
  const res = await fetch('api/state', {
    method,
    headers: { authorization: `Bearer ${getToken()}` },
    body,
  });
  if (!res.ok) throw new Error(`sync ${method}: ${res.status}`);
  return res.json();
}

// On startup: adopt the remote copy if it is newer than this device's.
export async function pull() {
  if (!getToken()) return false;
  try {
    const remote = await call('GET');
    if (!remote) return false;
    const localAt = Number(localStorage.getItem(STAMP_KEY)) || 0;
    if ((remote.updatedAt || 0) <= localAt) return false;
    for (const key of DATA_KEYS) {
      if (remote[key]) localStorage.setItem(key, remote[key]);
    }
    localStorage.setItem(STAMP_KEY, String(remote.updatedAt));
    return true;
  } catch {
    return false; // offline or misconfigured: stay local
  }
}

// Verify the configured token against the API (for setup feedback).
export async function test() {
  try {
    await call('GET');
    return true;
  } catch {
    return false;
  }
}

let pushTimer = null;

// After progress changes: debounce, then upload the whole blob.
export function push() {
  if (!getToken()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    call('PUT', JSON.stringify(collect())).catch(() => { /* retry next change */ });
  }, 1500);
}
