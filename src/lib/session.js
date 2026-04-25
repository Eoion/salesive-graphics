const KEY = 'salesive_session';

function ignoreStorageError() {}

export function saveSession(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    ignoreStorageError();
  }
}

export function updateSession(patch) {
  const current = loadSession() || {};
  const next = typeof patch === 'function'
    ? patch(current)
    : { ...current, ...patch };

  saveSession(next);
  return next;
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    ignoreStorageError();
    return null;
  }
}

export function clearSessionKeys(keys) {
  const current = loadSession();
  if (!current) return null;

  const next = { ...current };
  for (const key of keys) {
    delete next[key];
  }

  saveSession(next);
  return next;
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    ignoreStorageError();
  }
}
