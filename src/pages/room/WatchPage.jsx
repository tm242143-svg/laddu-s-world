import React, { useState } from 'react';
import { Link2, ListPlus, Pause, Play, Search, SkipForward } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { useApp } from '../../context/AppContext';
import { parseVideoId } from '../../lib/youtube';
import { searchYouTube } from '../../lib/ytsearch';
import { fmtTime } from '../../lib/util';
import QueuePanel from './QueuePanel';

const IDEAS = ['Tamil movie comedy scenes', 'Tamil full movie', 'Vijay mass scenes', 'Tamil trailers', 'Tamil short films', 'Cooking with Tamil chefs'];

export default function WatchPage() {
  const { nowPlaying, playing, togglePlay, skip, playNow, addToQueue, playerReady } = useRoom();
  const { toast } = useApp();
  const [text, setText] = useState(''); const [results, setResults] = useState([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  const asVideo = id => ({ video_id: id, title: `YouTube video ${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, kind: 'video' });
  // One box for everything: a link plays straight away, anything else is searched on YouTube.
  const submit = async term => {
    const t = (term ?? text).trim(); if (!t) return;
    const id = parseVideoId(t);
    if (id && (/^https?:/i.test(t) || /^[a-zA-Z0-9_-]{11}$/.test(t))) { playNow(asVideo(id)); setText(''); setResults([]); setErr(''); return; }
    setText(t); setBusy(true); setErr('');
    try { const r = await searchYouTube(t); setResults(r); if (!r.length) setErr('No videos found. Try different words.'); }
    catch (e) { setErr(e.message); setResults([]); }
    setBusy(false);
  };
  const addLink = () => { const id = parseVideoId(text); if (!id) { toast('Paste a valid YouTube link to add it, or search by name.', 'warn'); return; } addToQueue(asVideo(id)); setText(''); };

  return <div className="stack gap">
    <section className="glass panel stack">
      <div className="section-head tight"><div><span className="eyebrow">Watch together</span><h2>{nowPlaying?.title || 'Pick something to watch'}</h2></div>
        <div className="row tight"><button className="btn ghost sm" onClick={togglePlay} disabled={!playerReady || !nowPlaying}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause' : 'Play'}</button><button className="btn ghost sm" onClick={skip} disabled={!nowPlaying}><SkipForward size={14}/> Next</button></div></div>
      <form className="url-form" onSubmit={e => { e.preventDefault(); submit(); }}>
        <label className="search"><Search size={17}/><input value={text} onChange={e => setText(e.target.value)} placeholder="Search YouTube — or paste a link…" /></label>
        <button className="btn primary" disabled={busy}>{busy ? 'Searching…' : parseVideoId(text) ? 'Play for room' : 'Search'}</button>
        <button type="button" className="btn ghost" onClick={addLink} title="Add a pasted link to the queue"><Link2 size={16}/> Add link</button>
      </form>
      <div className="chips">{IDEAS.map(t => <button key={t} className="chip btn-chip" onClick={() => submit(t)}>{t}</button>)}</div>
      {err && <div className="form-msg">{err}</div>}
      {results.length > 0 && <ul className="song-list">{results.map(v => <li className="song-row yt-row" key={v.video_id}>
        <img src={v.thumbnail} alt="" loading="lazy" />
        <div className="q-meta"><b title={v.title}>{v.title}</b><span className="muted">{v.channel}{v.duration ? ` · ${fmtTime(v.duration)}` : ''}</span></div>
        <button className="btn primary sm" onClick={() => playNow(v)}><Play size={13} fill="currentColor"/> Play</button>
        <button className="btn ghost sm" onClick={() => addToQueue(v)}><ListPlus size={14}/> Queue</button>
      </li>)}</ul>}
      <p className="muted small">Everyone’s player stays in sync (play, pause, seek). Some videos block embedding — those are skipped automatically. The video keeps playing in a mini player when you open Games, Call or Chat.</p>
    </section>
    <QueuePanel />
  </div>;
}
