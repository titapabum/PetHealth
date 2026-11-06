import { profileAvatar } from "./profile-avatars.js";
// UI prototype only. No credentials or passwords are persisted or sent to a server.
const KEY = 'pet-health-demo-session';

export function readDemoSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || 'null');
    if (value && !value.id) value.id = value.email;
    if (value) value.avatar = profileAvatar(value.avatar);
    return value?.mode === 'mock' && typeof value.name === 'string' && typeof value.email === 'string' ? value : null;
  } catch { return null; }
}

export function startDemoSession({ name, email, remember }) {
  const user = { id: crypto.randomUUID(), avatar: profileAvatar(), name: name.trim() || email.split('@')[0], email, mode: 'mock' };
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

export function updateDemoProfile({ name, email, avatar }) {
  const current = readDemoSession();
  if (!current) throw new Error('กรุณาเข้าสู่ระบบก่อน');
  const user = { ...current, name: name.trim(), email: email.trim(), avatar: profileAvatar(avatar ?? current.avatar) };
  const storage = sessionStorage.getItem(KEY) ? sessionStorage : localStorage;
  storage.setItem(KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('pet-health-session', { detail: user }));
  return user;
}
