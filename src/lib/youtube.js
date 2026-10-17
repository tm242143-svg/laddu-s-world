// YouTube is now used ONLY for the "Watch together" video player (no API key needed).
// Songs come from lib/music.js (separate audio APIs).
export { fmtTime } from './util';
export function parseVideoId(value) {
  const input = String(value || '').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || '';
    if (url.hostname.includes('youtube.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      const i = parts.findIndex(p => ['embed', 'shorts', 'live'].includes(p));
      if (i >= 0) return parts[i + 1] || '';
    }
  } catch { /* not a URL */ }
  return '';
}
let apiPromise;
export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    if (!document.querySelector('script[data-lw-yt]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.dataset.lwYt = '1';
      s.onerror = () => { apiPromise = null; reject(new Error('Could not load the video player. Check your connection or ad-blocker.')); };
      document.head.appendChild(s);
    }
  });
  return apiPromise;
}
