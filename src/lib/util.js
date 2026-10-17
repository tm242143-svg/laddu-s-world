// Safe UUID: crypto.randomUUID() is undefined on plain-http pages (e.g. http://192.168.x.x on a phone),
// which silently broke chat on mobile. This works everywhere.
export const uuid = () => {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch { /* insecure context */ }
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
};
export const makeCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = new Uint8Array(6);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b); else b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
  return [...b].map(x => chars[x % chars.length]).join('');
};
export const initial = name => (name || 'U').trim().slice(0, 1).toUpperCase();
export const clsx = (...a) => a.filter(Boolean).join(' ');
export const fmtTime = s => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
