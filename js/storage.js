import { KEYS } from './config.js';

// localStorage kann fehlen oder Fehler werfen (privater Modus), deshalb try/catch
export function get(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function set(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* ignorieren */ }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignorieren */ }
}

export function clearSession() {
  Object.values(KEYS).forEach(remove);
}
