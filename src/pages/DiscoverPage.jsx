import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Plus, Search, Sparkles } from 'lucide-react';
import { supabase } from '../supabase';
import { useApp } from '../context/AppContext';
import { searchSongs } from '../lib/music';
import { SongRow } from './room/MusicPage';

const MOODS = [
  ['Love & melody', 'tamil melody love songs', '💞', 'g1'], ['Kuthu party', 'tamil kuthu dance', '🔥', 'g2'], ['Rahman magic', 'A R Rahman', '🎻', 'g3'], ['Ilaiyaraaja', 'Ilaiyaraaja', '🌿', 'g4'],
  ['Anirudh beats', 'Anirudh Ravichander', '⚡', 'g5'], ['Chill lo-fi', 'tamil lofi chill', '🌙', 'g6'], ['Sad & soulful', 'tamil sad songs', '🥀', 'g7'], ['Road trip', 'tamil travel songs', '🚗', 'g8'],
];

export default function DiscoverPage() {
  const { rooms, uid, displayName, toast } = useApp();
  const [q, setQ] = useState(''); const [list, setList] = useState([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [now, setNow] = useState(null);
  const [roomId, setRoomId] = useState(''); const audio = useRef(null);
  useEffect(() => { audio.current = new Audio(); const a = audio.current; a.onended = () => setNow(null); return () => { a.pause(); }; }, []);
  useEffect(() => { if (!roomId && rooms[0]) setRoomId(rooms[0].id); }, [rooms, roomId]);

  const go = async term => {
    const t = (term ?? q).trim(); if (!t) return; setQ(t); setBusy(true); setErr('');
    try { const r = await searchSongs(t); setList(r); if (!r.length) setErr('Nothing found — try another word.'); } catch (e) { setErr(e.message); setList(e.fallback || []); }
    setBusy(false);
  };
  const preview = s => { if (!s.audio_url) { toast('YouTube songs play inside a room (full length).', 'info'); return; } const a = audio.current; if (now === s.video_id) { a.pause(); setNow(null); return; } a.src = s.audio_url; a.play().then(() => setNow(s.video_id), () => toast('Could not play this preview.', 'warn')); };
  const send = async s => {
    if (!roomId) { toast('Create or join a room first.', 'warn'); return; }
    const { error } = await supabase.from('room_queue').insert({ room_id: roomId, video_id: s.video_id, title: s.title, channel: s.channel, thumbnail: s.thumbnail || null, kind: s.kind || 'song', added_by: uid, added_by_name: displayName, ...(s.audio_url ? { audio_url: s.audio_url, provider: s.provider } : {}) });
    toast(error ? (/audio_url|provider|check/i.test(error.message) ? 'Run supabase/upgrade-v3.sql once.' : error.message) : 'Added to the room queue 🎶', error ? 'warn' : 'love');
  };

  return <div className="page">
    <section className="hero glass discover-hero">
      <div className="hero-copy"><span className="eyebrow"><Sparkles size={13}/> Discover</span><h1>Find your next <em>favourite song.</em></h1><p>Pick a mood or search anything, preview it instantly, then drop it into a room queue.</p>
        <form className="url-form" onSubmit={e => { e.preventDefault(); go(); }}><label className="search"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Song, singer, movie…" /></label><button className="btn primary" disabled={busy}>{busy ? '…' : 'Search'}</button></form></div>
      <div className="hero-art" aria-hidden="true"><div className="orb o1"/><div className="orb o2"/><div className="vinyl big spin"><span>♪</span></div><span className="eq big"><i/><i/><i/><i/><i/></span></div>
    </section>
    <section><div className="section-head"><h2>Moods</h2></div>
      <div className="mood-grid">{MOODS.map(([t, query, e, g], i) => <button key={t} className={`mood ${g}`} style={{ animationDelay: `${i * 60}ms` }} onClick={() => go(query)}><span className="mood-emoji">{e}</span><b>{t}</b></button>)}</div></section>
    {(err || list.length > 0) && <section className="glass panel stack">
      <div className="section-head tight"><h3>Results</h3>{rooms.length > 0 && <label className="row tight small">Send to <select value={roomId} onChange={e => setRoomId(e.target.value)}>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}</div>
      {err && <div className="form-msg">{err}</div>}
      <ul className="song-list">{list.map(s => <SongRow key={s.video_id} s={s} extra={<><button className="btn ghost sm" onClick={() => preview(s)}>{now === s.video_id ? <Pause size={13}/> : <Play size={13}/>} Preview</button><button className="btn primary sm" onClick={() => send(s)}><Plus size={13}/> Room</button></>} />)}</ul>
    </section>}
  </div>;
}
