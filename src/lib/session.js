const KEY = 'salesive_session';

export function saveSession(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
