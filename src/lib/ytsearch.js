// YouTube search so nobody has to paste links.
// 1) If VITE_YOUTUBE_API_KEY is set -> official YouTube Data API v3 (most reliable, embeddable-only results).
// 2) Otherwise -> public Piped / Invidious mirrors (no key, but community-run, so they can be flaky).
const KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const PIPED = ['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://api.piped.private.coffee', 'https://pipedapi.leptons.xyz', 'https://pipedapi.reallyaweso.me', 'https://piped-api.garudalinux.org'];
const INVIDIOUS = ['https://invidious.nerdvpn.de', 'https://inv.nadeko.net', 'https://yewtu.be', 'https://invidious.privacyredirect.com', 'https://inv.tux.pizza'];

async function getJson(url, ms = 7000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
  finally { clearTimeout(t); }
}
const decode = s => { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; };
const isoSecs = d => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const mk = (id, title, channel, duration) => ({ video_id: id, title: decode(title), channel: decode(channel || ''), duration: duration || 0, thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, kind: 'video', provider: 'youtube' });

async function viaApi(q, max) {
  const s = await getJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoSyndicated=true&maxResults=${max}&q=${encodeURIComponent(q)}&key=${KEY}`);
  const ids = (s.items || []).map(i => i.id?.videoId).filter(Boolean);
  let dur = {};
  if (ids.length) { try { (await getJson(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${KEY}`)).items?.forEach(v => { dur[v.id] = isoSecs(v.contentDetails?.duration); }); } catch { /* durations optional */ } }
  return (s.items || []).filter(i => i.id?.videoId).map(i => mk(i.id.videoId, i.snippet?.title, i.snippet?.channelTitle, dur[i.id.videoId]));
}
async function viaPiped(q) {
  let last;
  for (const b of PIPED) {
    try {
      const j = await getJson(`${b}/search?q=${encodeURIComponent(q)}&filter=videos`);
      const out = (j.items || []).filter(i => i.url?.includes('watch?v=') && !i.isShort).map(i => mk(i.url.split('v=')[1].split('&')[0], i.title, i.uploaderName, i.duration));
      if (out.length) return out;
    } catch (e) { last = e; }
  }
  throw last || new Error('no results');
}
async function viaInvidious(q) {
  let last;
  for (const b of INVIDIOUS) {
    try {
      const j = await getJson(`${b}/api/v1/search?q=${encodeURIComponent(q)}&type=video`);
      const out = (Array.isArray(j) ? j : []).filter(i => i.videoId).map(i => mk(i.videoId, i.title, i.author, i.lengthSeconds));
      if (out.length) return out;
    } catch (e) { last = e; }
  }
  throw last || new Error('no results');
}

export async function searchYouTube(query, max = 15) { return onlyEmbeddable(await rawSearch(query, max)); }
async function rawSearch(query, max = 15) {
  const q = query.trim(); if (!q) return [];
  if (KEY) { try { return await viaApi(q, max); } catch (e) { /* quota / bad key -> fall through to mirrors */ } }
  try { return await viaPiped(q); } catch { /* next */ }
  try { return await viaInvidious(q); } catch { /* next */ }
  throw new Error(KEY ? 'YouTube search failed (quota or key problem). You can still paste a link.' : 'YouTube search needs VITE_YOUTUBE_API_KEY in .env (free from Google Cloud). Public mirrors are down right now — pasting a link still works.');
}

// YouTube's oEmbed answers 401/403 for videos whose owner disabled embedding. Checking it up front means
// the search list only shows videos that will actually play inside the room (network errors = assume OK).
const embedCache = new Map();
export async function canEmbed(id) {
  if (embedCache.has(id)) return embedCache.get(id);
  let ok = true;
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 4500);
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: c.signal }); clearTimeout(t);
    if (r.status === 401 || r.status === 403 || r.status === 404) ok = false;
  } catch { ok = true; }
  embedCache.set(id, ok); return ok;
}
export async function onlyEmbeddable(list) {
  const flags = await Promise.all(list.map(v => canEmbed(v.video_id)));
  const good = list.filter((_, i) => flags[i]);
  return good.length ? good : list;
}
// Find another upload of the same title that can be embedded (used when the chosen video blocks embedding).
export async function findEmbeddableAlternative(title, skipId) {
  const clean = String(title || '').replace(/\(.*?\)|\[.*?\]/g, ' ').trim();
  const list = (await searchYouTube(clean, 12)).filter(v => v.video_id !== skipId);
  const flags = await Promise.all(list.map(v => canEmbed(v.video_id)));
  return list.find((_, i) => flags[i]) || null;
}
