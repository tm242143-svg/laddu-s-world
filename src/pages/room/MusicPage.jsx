import React, { useState } from 'react';
import { ListPlus, Play, Search } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { searchSongs, PROVIDERS } from '../../lib/music';
import { fmtTime } from '../../lib/util';
import QueuePanel from './QueuePanel';

const QUICK = ['Ilaiyaraaja melodies', 'A. R. Rahman hits', 'Anirudh', 'Yuvan Shankar Raja', '90s Tamil love songs', 'Tamil kuthu', 'Harris Jayaraj', 'Sid Sriram'];
const TAG = { saavn: 'JioSaavn', audius: 'Audius', itunes: '30s preview', youtube: 'YouTube' };

export function SongRow({ s, onPlay, onAdd, extra }) {
  return <li className="song-row">
    {s.thumbnail ? <img src={s.thumbnail} alt="" loading="lazy" /> : <span className="song-ph">♪</span>}
    <div className="q-meta"><b title={s.title}>{s.title}</b><span className="muted">{s.channel}{s.duration ? ` · ${fmtTime(s.duration)}` : ''} · <em className="src">{TAG[s.provider] || ''}</em></span></div>
    {onPlay && <button className="btn primary sm" onClick={() => onPlay(s)}><Play size={13} fill="currentColor"/> Play</button>}
    {onAdd && <button className="btn ghost sm" onClick={() => onAdd(s)}><ListPlus size={14}/> Queue</button>}
    {extra}
  </li>;
}

export default function MusicPage() {
  const { playNow, addToQueue } = useRoom();
  const [q, setQ] = useState(''); const [prov, setProv] = useState('all'); const [results, setResults] = useState([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const search = async (term, p = prov) => {
    const text = (term ?? q).trim(); if (!text) return;
    setQ(text); setBusy(true); setErr('');
    try { const r = await searchSongs(text, p); setResults(r); if (!r.length) setErr('No songs found. Try the singer or movie name, or another source.'); }
    catch (e) { setErr(e.message); setResults(e.fallback || []); }
    setBusy(false);
  };
  return <div className="stack gap">
    <section className="glass panel stack">
      <div><span className="eyebrow">Full songs · JioSaavn + YouTube</span><h2>Search songs</h2></div>
      <form className="url-form" onSubmit={e => { e.preventDefault(); search(); }}>
        <label className="search"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Song, singer or movie…" /></label>
        <button className="btn primary" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      <div className="chips">{PROVIDERS.map(([k, l]) => <button key={k} className={`chip btn-chip ${prov === k ? 'on' : ''}`} onClick={() => { setProv(k); if (q.trim()) search(q, k); }}>{l}</button>)}</div>
      <div className="chips">{QUICK.map(t => <button key={t} className="chip btn-chip" onClick={() => search(t)}>{t}</button>)}</div>
      {err && <div className="form-msg">{err}</div>}
      {results.length > 0 && <ul className="song-list">{results.map(s => <SongRow key={s.video_id} s={s} onPlay={playNow} onAdd={addToQueue} />)}</ul>}
    </section>
    <QueuePanel />
  </div>;
}
