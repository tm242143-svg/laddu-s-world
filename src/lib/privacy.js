import { useEffect, useState } from 'react';
// Privacy preferences live ONLY on this device (localStorage) — never uploaded.
const KEY = 'lw-privacy';
export const DEFAULTS = { encryptChat: true, anonymousPresence: false, hideTyping: false, muteOnJoin: false, camOffOnJoin: false, sounds: true, wipeChatOnLeave: true, chatTtl: 0 };
// Messages are ALWAYS wiped on leaving a room and always encrypted when the browser allows it — these are no longer optional.
const FORCED = { wipeChatOnLeave: true, encryptChat: true };
export const getPrivacy = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}'), ...FORCED }; } catch { return { ...DEFAULTS, ...FORCED }; } };
const save = p => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ } window.dispatchEvent(new Event('lw-privacy')); };
export function usePrivacy() {
  const [p, setP] = useState(getPrivacy);
  useEffect(() => { const h = () => setP(getPrivacy()); window.addEventListener('lw-privacy', h); return () => window.removeEventListener('lw-privacy', h); }, []);
  return [p, patch => save({ ...getPrivacy(), ...patch })];
}
export const wipeLocalData = () => { try { const keep = sessionStorage.getItem('lw-intro'); sessionStorage.clear(); if (keep) sessionStorage.setItem('lw-intro', keep); Object.keys(localStorage).filter(k => k.startsWith('lw-')).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ } };
