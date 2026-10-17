import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Link2, ListPlus, Play, Search, Star, Tv, X } from 'lucide-react';
import { useRoom } from '../context/RoomContext';
import { useApp } from '../context/AppContext';
import { anilist, animeTitle, animerulzSearch, stripHtml, TAMIL_ANIME_URL } from '../lib/anime';
import { searchYouTube } from '../lib/ytsearch';

const SORTS = [['TRENDING_DESC', '🔥 Trending'], ['POPULARITY_DESC', '⭐ Popular'], ['SCORE_DESC', '🏆 Top rated'], ['START_DATE_DESC', '🆕 New']];
const GENRES = ['Action', 'Romance', 'Comedy', 'Fantasy', 'Slice of Life', 'Sci-Fi', 'Sports', 'Horror'];

const hashId = s => { let x = 5381; for (const c of s) x = ((x << 5) + x + c.charCodeAt(0)) >>> 0; return 'f' + x.toString(36); };
const nameFromUrl = u => { try { return decodeURIComponent(new URL(u).pathname.split('/').filter(Boolean).pop() || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_.]+/g, ' ').trim(); } catch { return ''; } };

// Paste a direct video file (.mp4 / .webm / .m3u8). It plays in the room player, in sync for everyone.
function DirectLink({ room }) {
  const { toast } = useApp(); const [url, setUrl] = useState(''); const [title, setTitle] = useState('');
  const item = () => {
    const u = url.trim();
    if (!/^https:\/\//i.test(u)) { toast('Use a secure https:// link to a video file (.mp4, .webm or .m3u8).', 'warn'); return null; }
    return { video_id: hashId(u), title: title.trim() || nameFromUrl(u) || 'Video link', audio_url: u, kind: 'video', provider: 'link', thumbnail: null, channel: 'Direct link' };
  };
  return <section className="glass anime-direct"><b><Link2 size={15}/> Play a video link together</b>
    <p className="muted small">Paste a direct link to a video file you are allowed to watch (.mp4, .webm or .m3u8). Everyone in the room plays it in sync.</p>
    <form onSubmit={e => { e.preventDefault(); const it = item(); if (it) { room.playNow(it); setUrl(''); setTitle(''); } }}>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…/episode-1.mp4" aria-label="Video link" />
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" aria-label="Title" />
      <button className="btn primary sm"><Play size={13} fill="currentColor"/> Play for room</button>
      <button type="button" className="btn ghost sm" onClick={() => { const it = item(); if (it) { room.addToQueue(it); setUrl(''); setTitle(''); } }}><ListPlus size={14}/> Queue</button>
    </form></section>;
}

function Detail({ a, onClose }) {
  const room = useRoom(); const inRoom = Boolean(room?.playNow);
  const asVid = v => ({ ...v, kind: 'video' });
  const t = animeTitle(a); const [eps, setEps] = useState([]); const [busy, setBusy] = useState(true); const [cur, setCur] = useState(null); const [err, setErr] = useState('');
  useEffect(() => {
    let live = true; setBusy(true);
    (async () => {
      try {
        const lists = await Promise.allSettled([searchYouTube(`${t} full episode Ani-One Asia`, 10), searchYouTube(`${t} episode 1 Muse Asia anime`, 10)]);
        const seen = new Set(); const all = lists.flatMap(r => (r.status === 'fulfilled' ? r.value : [])).filter(v => !seen.has(v.video_id) && seen.add(v.video_id));
        // Prefer official anime channels and full-length uploads.
        const score = v => (/ani-?one|muse|crunchyroll|netflix anime|bilibili|aniplus|tms entertainment|yu-gi-oh|toei animation/i.test(v.channel || '') ? 2 : 0) + (v.duration > 900 ? 1 : 0) + (new RegExp(t.split(' ')[0], 'i').test(v.title) ? 1 : 0);
        const sorted = all.sort((x, y) => score(y) - score(x)).slice(0, 12);
        if (live) { setEps(sorted); if (!sorted.length) setErr('No free episodes found on YouTube for this title — try AnimeRulz or the legal free sites below.'); }
      } catch { if (live) setErr('Could not search right now — try again in a moment, or use the links below.'); }
      if (live) setBusy(false);
    })();
    return () => { live = false; };
  }, [t]);
  const trailer = a.trailer?.site === 'youtube' ? a.trailer.id : null; const vid = inRoom ? null : (cur || trailer);
  const playRoom = v => { room.playNow(asVid(v)); onClose(); };
  // Lock page scroll and close on Escape while the dialog is open.
  useEffect(() => {
    document.body.classList.add('no-scroll');
    const k = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => { document.body.classList.remove('no-scroll'); window.removeEventListener('keydown', k); };
  }, [onClose]);
  // Portal to <body>: the animated page wrapper would otherwise offset a position:fixed modal under the nav.
  return createPortal(<div className="anime-modal" role="dialog" aria-modal="true" onClick={onClose}><div className="glass anime-detail" onClick={e => e.stopPropagation()}>
    <button className="astro-x" onClick={onClose} aria-label="Close"><X size={18}/></button>
    {inRoom && a.bannerImage && <img className="anime-cover" src={a.bannerImage} alt="" />}
    {vid && <div className="anime-player"><iframe key={vid} title={t} src={`https://www.youtube-nocookie.com/embed/${vid}?autoplay=${cur ? 1 : 0}&rel=0&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>}
    <div className="anime-info"><h2>{t}</h2>
      <p className="muted small">{[a.seasonYear, a.episodes ? `${a.episodes} eps` : '', a.status?.replace(/_/g, ' ').toLowerCase(), a.averageScore ? `★ ${(a.averageScore / 10).toFixed(1)}` : ''].filter(Boolean).join(' · ')}</p>
      <div className="row tight wrap">{(a.genres || []).slice(0, 4).map(g => <span className="chip" key={g}>{g}</span>)}</div>
      <p>{stripHtml(a.description).slice(0, 420)}{stripHtml(a.description).length > 420 ? '…' : ''}</p></div>
    <h3>{inRoom ? 'Watch together' : 'Watch free'}</h3>
    {inRoom && trailer && <div className="row wrap"><button className="btn ghost sm" onClick={() => playRoom({ video_id: trailer, title: `${t} — trailer`, thumbnail: `https://i.ytimg.com/vi/${trailer}/mqdefault.jpg`, channel: 'Trailer' })}><Play size={13}/> Play trailer for room</button></div>}
    {busy && <p className="muted small">Finding free episodes…</p>}{err && <p className="muted small">{err}</p>}
    <ul className="anime-eps">{eps.map(v => <li key={v.video_id}><button className={cur === v.video_id ? 'on' : ''} onClick={() => (inRoom ? playRoom(v) : setCur(v.video_id))}>{v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" />}<span><b>{v.title}</b><small>{v.channel}</small></span><Play size={16}/></button>{inRoom && <button className="btn ghost sm" onClick={() => room.addToQueue(asVid(v), { playIfIdle: false })} aria-label="Add to room queue"><ListPlus size={14}/></button>}</li>)}</ul>
    <div className="row wrap"><a className="btn primary sm" href={animerulzSearch(t)} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> Find on AnimeRulz</a>
      <a className="btn ghost sm" href={`https://www.crunchyroll.com/search?q=${encodeURIComponent(t)}`} target="_blank" rel="noopener noreferrer">Crunchyroll</a>
      <a className="btn ghost sm" href={`https://tubitv.com/search/${encodeURIComponent(t)}`} target="_blank" rel="noopener noreferrer">Tubi (free)</a>
      <a className="btn ghost sm" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${t} full episode`)}`} target="_blank" rel="noopener noreferrer">YouTube</a></div>
  </div></div>, document.body);
}

export default function AnimePage() {
  const room = useRoom(); const inRoom = Boolean(room?.playNow);
  const [q, setQ] = useState(''); const [sort, setSort] = useState('TRENDING_DESC'); const [genre, setGenre] = useState('');
  const [list, setList] = useState([]); const [busy, setBusy] = useState(true); const [err, setErr] = useState(''); const [sel, setSel] = useState(null);
  const load = async (opts = {}) => { setBusy(true); setErr(''); try { const r = await anilist({ search: opts.search ?? q, sort: opts.sort ?? sort, genre: opts.genre ?? genre }); setList(r); if (!r.length) setErr('Nothing found — try another name.'); } catch { setErr('Could not load anime. Check your connection and try again.'); setList([]); } setBusy(false); };
  useEffect(() => { load({ search: '' }); /* eslint-disable-next-line */ }, [sort, genre]);
  return <div className={inRoom ? 'stack gap' : 'page'}>
    {inRoom && <DirectLink room={room} />}
    {!inRoom && <section className="hero glass"><div className="hero-copy"><span className="eyebrow"><Tv size={13}/> Anime</span><h1>Watch anime, <em>free.</em></h1><p>Browse thousands of titles and stream free official episodes right here. Want Tamil dubs? We link straight to AnimeRulz.</p>
      <div className="row wrap"><a className="btn primary" href={TAMIL_ANIME_URL} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Tamil dubbed anime (AnimeRulz)</a></div></div></section>}
    <form className="url-form" onSubmit={e => { e.preventDefault(); load({ search: q.trim() }); }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search anime — Naruto, Your Name, One Piece…" aria-label="Search anime" /><button className="btn primary"><Search size={16}/> Search</button></form>
    <div className="row wrap tight">{SORTS.map(([k, l]) => <button key={k} className={`chip btn-chip ${sort === k && !q ? 'ok' : ''}`} onClick={() => { setQ(''); setSort(k); }}>{l}</button>)}</div>
    <div className="row wrap tight">{GENRES.map(g => <button key={g} className={`chip btn-chip ${genre === g ? 'ok' : ''}`} onClick={() => setGenre(x => (x === g ? '' : g))}>{g}</button>)}</div>
    {busy && <p className="muted">Loading anime…</p>}{err && <p className="muted">{err}</p>}
    <div className="anime-grid">{list.map(a => <button key={a.id} className="anime-card" onClick={() => setSel(a)} style={{ '--ac': a.coverImage?.color || '#8b5cf6' }}><img src={a.coverImage?.large} alt="" loading="lazy" /><span className="anime-score"><Star size={11} fill="currentColor"/> {a.averageScore ? (a.averageScore / 10).toFixed(1) : '–'}</span><b>{animeTitle(a)}</b><small>{a.seasonYear || ''}{a.episodes ? ` · ${a.episodes} eps` : ''}</small></button>)}</div>
    <p className="muted small">Catalogue by AniList. Free episodes come from official YouTube channels where available. We don’t host any video; AnimeRulz is a third-party site opened in a new tab.</p>
    {sel && <Detail a={sel} onClose={() => setSel(null)} />}
  </div>;
}