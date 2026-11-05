// UI prototype only. No credentials or passwords are persisted or sent to a server.
const KEY = 'pet-health-demo-session';

export function readDemoSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || 'null');
    return value?.mode === 'mock' && typeof value.name === 'string' && typeof value.email === 'string' ? value : null;
  } catch { return null; }
}

export function startDemoSession({ name, email, remember }) {
  const user = { name: name.trim() || email.split('@')[0], email, mode: 'mock' };
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(user));
  } catch { /* The current tab can still show the demo with storage disabled. */ }
  window.dispatchEvent(new CustomEvent('pet-health-session', { detail: user }));
  return user;
}

export function endDemoSession() {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* Storage may be disabled. */ }
  window.dispatchEvent(new CustomEvent('pet-health-session', { detail: null }));
}
