import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Music2, Pause, Play, X } from 'lucide-react';
import { MOVIES } from '../lib/movies';
import { searchSongs } from '../lib/music';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'];
// The centrepiece of the home page: a 3-D rotating deck of Tamil movie cards. Click the centre card to flip it and hear its songs.
export default function MovieSpotlight() {
  const [i, setI] = useState(0); const [flip, setFlip] = useState(false); const [hover, setHover] = useState(false);
  const [songs, setSongs] = useState([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [now, setNow] = useState(null);
  const audio = useRef(null); const n = MOVIES.length; const m = MOVIES[i];
  useEffect(() => { audio.current = new Audio(); audio.current.onended = () => setNow(null); return () => audio.current?.pause(); }, []);
  useEffect(() => { if (flip || hover) return; const t = setInterval(() => setI(x => (x + 1) % n), 3800); return () => clearInterval(t); }, [flip, hover, n]);
  const go = d => { audio.current?.pause(); setNow(null); setFlip(false); setSongs([]); setErr(''); setI(x => (x + d + n) % n); };
  const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  // Resolve each known song title to a playable track; keep the title even when no stream is found (then it links to YouTube).
  const resolve = async (song, movie) => {
    const want = norm(song); const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song} ${movie} tamil song`)}`;
    try {
      const r = await searchSongs(`${song} ${movie}`, 'saavn');
      const scored = r.filter(x => x.audio_url).map(x => { const got = norm(x.title); const hit = want.filter(w => got.includes(w)).length / Math.max(1, want.length); return { x, hit }; }).sort((p, q) => q.hit - p.hit);
      if (scored[0] && scored[0].hit >= 0.6) return { ...scored[0].x, title: song, yt };
    } catch { /* fall through */ }
    return { video_id: `m:${song}`, title: song, yt };
  };
  const open = async () => {
    setFlip(true); setBusy(true); setErr(''); setSongs(m.songs.map(t => ({ video_id: `m:${t}`, title: t, pending: true })));
    const movie = m.title; const res = await Promise.all(m.songs.map(t => resolve(t, movie)));
    setSongs(res); if (!res.some(x => x.audio_url)) setErr('Streams are busy right now — tap a song to open it on YouTube.');
    setBusy(false);
  };
  const play = s => { const a = audio.current; if (now === s.video_id) { a.pause(); setNow(null); return; } a.src = s.audio_url; a.play().then(() => setNow(s.video_id), () => setErr('Could not play this song.')); };
  const off = k => { let d = k - i; if (d > n / 2) d -= n; if (d < -n / 2) d += n; return d; };

  return <section className="movie-stage" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
    <div className="movie-glow" style={{ '--c1': m.colors[0], '--c2': m.colors[1] }} aria-hidden="true" />
    <div className="movie-head"><span className="eyebrow"><Music2 size={13}/> Tamil cinema spotlight</span><h2>Pick a film. <em>Hear its magic.</em></h2></div>
    <div className="movie-deck">
      <button className="movie-nav l" onClick={() => go(-1)} aria-label="Previous movie"><ChevronLeft size={22}/></button>
      {MOVIES.map((mv, k) => { const d = off(k); if (Math.abs(d) > 3) return null; const center = d === 0;
        return <article key={mv.title} className={`movie-card ${center ? 'center' : ''} ${center && flip ? 'flipped' : ''}`}
          style={{ '--d': d, '--c1': mv.colors[0], '--c2': mv.colors[1] }} onClick={() => (center ? (flip ? null : open()) : go(d))}
          role="button" tabIndex={center ? 0 : -1} onKeyDown={e => center && e.key === 'Enter' && !flip && open()}>
          <div className="mc-inner">
            <div className="mc-face mc-front">
            <i className="mc-corner tl">✦</i><i className="mc-corner tr">✦</i><i className="mc-corner bl">✦</i><i className="mc-corner br">✦</i>
            <div className="mc-sky" aria-hidden="true">{Array.from({ length: 14 }, (_, q) => <i key={q} style={{ left: `${(q * 29 + k * 11) % 100}%`, top: `${(q * 47 + k * 7) % 100}%`, animationDelay: `${(q % 7) * 0.4}s` }} />)}</div>
            <span className="mc-num">{ROMAN[k % ROMAN.length]}</span>
            <div className="mc-orb" aria-hidden="true"><span className="mc-ring" /><span className="mc-reel">🎬</span></div>
            <h3>{mv.title}</h3><div className="mc-rule"><b>✦</b></div>
            <p>{mv.lead}</p><small>♪ {mv.music}</small>
            <div className="mc-foot"><span>{mv.year}</span><span>{mv.genre}</span></div>
            {center && <span className="mc-tap">Tap to reveal songs</span>}</div>
            <div className="mc-face mc-back">{center && <>
              <button className="astro-x" onClick={e => { e.stopPropagation(); audio.current?.pause(); setNow(null); setFlip(false); }} aria-label="Close"><X size={16}/></button>
              <h4>{mv.title} · songs</h4>
              {busy && <p className="muted small">Finding the exact songs…</p>}{err && <p className="muted small">{err}</p>}
              <ul>{songs.map(s => <li key={s.video_id}>{s.audio_url ? <button onClick={e => { e.stopPropagation(); play(s); }}>{now === s.video_id ? <Pause size={14}/> : <Play size={14}/>}<span>{s.title}</span></button> : <a className="mc-yt" href={s.yt || '#'} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}><Play size={14}/><span>{s.title}{s.pending ? ' …' : ' · YouTube'}</span></a>}</li>)}</ul>
              <small className="muted">Tip: add songs to a room queue from Discover.</small></>}</div>
          </div>
        </article>; })}
      <button className="movie-nav r" onClick={() => go(1)} aria-label="Next movie"><ChevronRight size={22}/></button>
    </div>
    <div className="movie-dots">{MOVIES.map((_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => go(off(k))} aria-label={`Movie ${k + 1}`} />)}</div>
  </section>;
}
