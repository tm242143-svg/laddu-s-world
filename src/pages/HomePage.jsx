import React from 'react';
import { ArrowRight, Compass, Mic, ShieldCheck, MessageCircle, Star, Tv, Gamepad2, Music2, PlayCircle, Plus, UserPlus, Video, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { navigate } from '../lib/router';
import { burstHearts } from '../components/HeartCanvas';
import MovieSpotlight from '../components/MovieSpotlight';

const FEATURES = [
  [PlayCircle, 'Watch together', 'Videos in perfect sync, with a shared queue.', '/rooms'],
  [Music2, 'Full songs', 'Search JioSaavn + YouTube and build a room playlist.', '/discover'],
  [Gamepad2, 'Room games', 'Tic-Tac-Toe, Connect Four and more — live.', '/rooms'],
  [Video, 'Video & voice calls', 'Private, phone-friendly calls with screen share.', '/rooms'],
  [Mic, 'Ring the room', 'One tap to call everyone in a room.', '/rooms'],
  [MessageCircle, 'Encrypted chat', 'Never stored. End-to-end encrypted.', '/rooms'],
  [Compass, 'Discover music', 'Moods, previews & songs from open APIs.', '/discover'],
  [Tv, 'Free anime', 'Stream anime free, plus Tamil dubs via AnimeRulz.', '/anime'],
  [Star, 'Astrology', 'Daily rasipalan, partner porutham & your future.', '/astro'],
  [ShieldCheck, 'Privacy controls', 'Guest mode, mute-on-join, wipe on leave.', '/settings'],
];

export default function HomePage() {
  const { displayName, rooms, requests } = useApp();
  return <div className="page">
    <div className="marquee" aria-hidden="true"><div>{[...Array(2)].map((_, k) => <span key={k}>♥ Watch together ♥ Voice & video ♥ Tamil songs ♥ Games ♥ Private by design ♥ Laddu’s World </span>)}</div></div>
    <MovieSpotlight />
    <section className="hero glass">
      <div className="hero-copy">
        <span className="eyebrow">Hi {displayName.split(' ')[0]} ♥</span>
        <h1>Make tonight a <em>shared story.</em></h1>
        <p>Pick a room, press play, and let everyone feel like they’re in the same place.</p>
        <div className="row">
          <button className="btn primary lg" onClick={() => { burstHearts({ n: 40 }); navigate('/rooms'); }}><Plus size={18}/> Create or join a room</button>
          <button className="btn ghost lg" onClick={() => navigate('/friends')}><UserPlus size={18}/> Find friends{requests.length > 0 && <span className="pill">{requests.length}</span>}</button>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="orb o1"/><div className="orb o2"/><div className="heart-card">♥</div></div>
    </section>

    <section>
      <div className="section-head"><h2>Everything has its own page</h2><p className="muted">Tap a card to jump in.</p></div>
      <div className="grid4">{FEATURES.map(([Icon, t, d, to], i) => <article className="glass tile tilt" key={t} style={{ animationDelay: `${i * 70}ms` }} onClick={() => navigate(to)} role="link" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate(to)}><span className="tile-icon"><Icon size={22}/></span><h3>{t}</h3><p className="muted">{d}</p></article>)}</div>
    </section>

    <section>
      <div className="section-head"><h2>Your rooms</h2><button className="link-btn" onClick={() => navigate('/rooms')}>Manage all <ArrowRight size={14}/></button></div>
      {rooms.length === 0 ? <div className="glass empty"><Users size={28}/><p>No rooms yet — your first one is two taps away.</p></div> :
        <div className="grid3">{rooms.slice(0, 3).map((r, i) => <button key={r.id} className={`glass room-card art-${i % 4}`} onClick={() => navigate(`/room/${r.id}/watch`)}>
          <span className="room-code">{r.code}</span><h3>{r.name}</h3><span className="muted">{r.visibility} room</span><ArrowRight className="go" size={18}/></button>)}</div>}
    </section>
  </div>;
}
