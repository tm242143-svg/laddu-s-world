// Song search via independent audio APIs (NOT YouTube). All return a common track shape:
// { video_id: "<provider>:<id>", title, channel, thumbnail, duration, audio_url, provider, kind:'song' }
// - saavn : JioSaavn-compatible API (best for Tamil). Unofficial; point VITE_SAAVN_API at your own deployment for reliability.
// - audius: free, full-length independent-artist streams.
// - itunes: Apple's public search (30-second previews).
// Several community JioSaavn-compatible mirrors; the first one that answers wins (they go up and down often).
// Put your own deployment first with VITE_SAAVN_API for the best reliability.
const SAAVN_HOSTS = [import.meta.env.VITE_SAAVN_API, 'https://saavn.dev/api', 'https://jiosaavn-api-privatecvc2.vercel.app/api', 'https://saavn.me/api', 'https://jiosaavn-api.vercel.app/api'].filter(Boolean).map(h => h.replace(/\/$/, ''));
const APP = 'laddus-world';
import { searchYouTube } from './ytsearch';
import { supabase } from '../supabase';
export const PROVIDERS = [['all', 'All sources'], ['saavn', 'Tamil · JioSaavn'], ['youtube', 'YouTube (full)'], ['audius', 'Audius (full)'], ['itunes', '30s previews']];

async function getJson(url, ms = 8000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
  finally { clearTimeout(t); }
}
const https = u => String(u || '').replace(/^http:\/\//i, 'https://');
const decode = s => { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; };
const pickUrl = (arr = []) => { if (typeof arr === 'string') return https(arr); const get = f => https(f?.url || f?.link || ''); const pref = ['160kbps', '320kbps', '96kbps', '48kbps', '12kbps']; for (const q of pref) { const f = arr.find(x => x.quality === q); if (get(f)) return get(f); } return get(arr.at(-1)) || get(arr[0]); };
const imgOf = im => https(Array.isArray(im) ? (im.at(-1)?.url || im.at(-1)?.link || '') : String(im || '').replace('150x150', '500x500'));
const artistsOf = s => decode(Array.isArray(s.artists?.primary) ? s.artists.primary.map(a => a.name).slice(0, 3).join(', ') : (s.primaryArtists || s.singers || (typeof s.album === 'string' ? s.album : s.album?.name) || ''));

async function saavn(q) {
  let last;
  for (const host of SAAVN_HOSTS) {
    try {
      const j = await getJson(`${host}/search/songs?query=${encodeURIComponent(q)}&limit=20`);
      const rows = j?.data?.results || j?.results || [];
      const out = rows.map(s => ({ video_id: `saavn:${s.id}`, title: decode(s.name || s.title), channel: artistsOf(s), thumbnail: imgOf(s.image), duration: Number(s.duration) || 0, audio_url: pickUrl(s.downloadUrl), provider: 'saavn' })).filter(s => s.audio_url);
      if (out.length) return out;
    } catch (e) { last = e; }
  }
  if (last) throw last; return [];
}
let audiusHost = '';
async function audiusBase() {
  if (audiusHost) return audiusHost;
  try { const j = await getJson(`https://api.audius.co?app_name=${APP}`, 5000); const h = (j?.data || []).filter(Boolean); if (h.length) audiusHost = h[Math.floor(Math.random() * h.length)].replace(/\/$/, ''); } catch { /* use default */ }
  return audiusHost || 'https://api.audius.co';
}
async function audius(q) {
  const base = await audiusBase();
  let j; try { j = await getJson(`${base}/v1/tracks/search?query=${encodeURIComponent(q)}&limit=20&app_name=${APP}`); } catch (e) { audiusHost = ''; throw e; }
  return (j?.data || []).filter(t => t.is_streamable !== false).map(t => ({
    video_id: `audius:${t.id}`, title: t.title, channel: t.user?.name || '', thumbnail: t.artwork?.['480x480'] || t.artwork?.['150x150'] || '',
    duration: t.duration || 0, audio_url: `${base}/v1/tracks/${t.id}/stream?app_name=${APP}`, provider: 'audius',
  }));
}
async function itunes(q) {
  const j = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=20&country=IN`);
  return (j?.results || []).filter(t => t.previewUrl).map(t => ({
    video_id: `itunes:${t.trackId}`, title: t.trackName, channel: [t.artistName, t.collectionName].filter(Boolean).join(' · '),
    thumbnail: (t.artworkUrl100 || '').replace('100x100', '400x400'), duration: 30, audio_url: t.previewUrl, provider: 'itunes',
  }));
}
async function youtube(q) { return (await searchYouTube(`${q} song`, 15)).filter(v => !v.duration || (v.duration >= 90 && v.duration <= 900)); }
// Songs curated in Supabase (song_library) — always reachable because it is your own database.
async function library(q) {
  const t = q.replace(/[%,()]/g, ' ').trim(); if (!t) return [];
  const { data } = await supabase.from('song_library').select('video_id,title,artist,movie').or(`title.ilike.%${t}%,artist.ilike.%${t}%,movie.ilike.%${t}%`).limit(20);
  return (data || []).map(r => ({ video_id: r.video_id, title: r.title, channel: [r.artist, r.movie].filter(Boolean).join(' · '), duration: 0, thumbnail: `https://i.ytimg.com/vi/${r.video_id}/mqdefault.jpg`, kind: 'video', provider: 'youtube' }));
}
// Last resort: the three songs bundled with the app, so the player never feels dead.
const BUNDLED = [['dreamy-rain', 'Dreamy Rain'], ['neon-drive', 'Neon Drive'], ['lofi-sunset', 'Lo-fi Sunset']].map(([f, title]) => ({ video_id: `local:${f}`, title, channel: 'Laddu’s World (built-in)', thumbnail: '', duration: 0, audio_url: `${import.meta.env.BASE_URL || '/'}music/${f}.wav`, provider: 'local', kind: 'song' }));
const MAP = { saavn, audius, itunes, youtube, library };

export async function searchSongs(query, provider = 'all') {
  const q = query.trim(); if (!q) return [];
  // 30-second Apple previews are opt-in only; the default mix is full-length songs.
  const names = provider === 'all' ? ['saavn', 'youtube', 'audius', 'library'] : [provider];
  let res = await Promise.allSettled(names.map(n => MAP[n](q)));
  let ok = res.filter(r => r.status === 'fulfilled').map(r => r.value).filter(a => a.length);
  // A chosen source is down or empty -> quietly try the others before giving up.
  if (!ok.length && provider !== 'all') { res = await Promise.allSettled(['saavn', 'youtube', 'audius', 'library', 'itunes'].filter(n => n !== provider).map(n => MAP[n](q))); ok = res.filter(r => r.status === 'fulfilled').map(r => r.value).filter(a => a.length); }
  if (!ok.length && res.every(r => r.status === 'rejected')) {
    const hit = BUNDLED.filter(b => b.title.toLowerCase().includes(q.toLowerCase()));
    if (!navigator.onLine) throw new Error('You look offline — reconnect and search again.');
    throw Object.assign(new Error('Online song sources did not answer. Showing built-in songs — tap Search again in a moment, or try “30s previews”.'), { fallback: hit.length ? hit : BUNDLED });
  }
  // Interleave so every provider shows up near the top.
  const out = []; const max = Math.max(...ok.map(a => a.length));
  for (let i = 0; i < max; i++) ok.forEach(a => { if (a[i]) out.push({ ...a[i], kind: a[i].kind || 'song' }); });
  return out;
}

export const rowToItem = r => ({ queue_id: r.id, video_id: r.video_id, title: r.title, thumbnail: r.thumbnail, channel: r.channel, kind: r.kind, audio_url: r.audio_url || null, provider: r.provider || null });
