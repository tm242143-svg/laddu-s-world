import React, { useEffect, useRef, useState } from 'react';
import { PhoneCall, PhoneOff, ArrowLeft, Copy, Gamepad2, MessageCircle, Music2, Pause, Play, PlayCircle, Settings, SkipForward, SkipBack, Video, Maximize2, Users, ExternalLink, Tv } from 'lucide-react';
import { RoomProvider, useRoom } from '../context/RoomContext';
import { useApp } from '../context/AppContext';
import { navigate } from '../lib/router';
import { initial } from '../lib/util';
import WatchPage from './room/WatchPage';
import MusicPage from './room/MusicPage';
import GamesPage from './room/GamesPage';
import CallPage, { CallPanel } from './room/CallPage';
import ChatPage from './room/ChatPage';
import ManagePage from './room/ManagePage';
import AnimePage from './AnimePage';
import PlayerControls from './room/PlayerControls';

const TABS = [['watch', 'Watch', PlayCircle], ['anime', 'Anime', Tv], ['music', 'Music', Music2], ['games', 'Games', Gamepad2], ['call', 'Call', Video], ['chat', 'Chat', MessageCircle], ['manage', 'Manage', Settings]];
const EMOJIS = ['❤️', '😂', '🔥', '👏', '🥹', '🎉'];

const MINI_KEY = 'lw-mini-pos';
const miniSize = () => { const w = window.innerWidth <= 600 ? 200 : 300; return [w, Math.round(w * 9 / 16)]; };
const clampPos = (x, y) => { const [w, h] = miniSize(); return [Math.min(Math.max(4, x), Math.max(4, window.innerWidth - w - 4)), Math.min(Math.max(4, y), Math.max(4, window.innerHeight - h - 4))]; };
const defaultPos = () => { try { const p = JSON.parse(localStorage.getItem(MINI_KEY) || 'null'); if (p) return clampPos(p[0], p[1]); } catch { /* ignore */ } const [w, h] = miniSize(); return clampPos(window.innerWidth - w - 10, window.innerHeight - h - 90); };

function Dock({ tab }) {
  const { roomId, setHostEl, nowPlaying, playing, needsTap, resumeTap, togglePlay, skip, prev, playerReady, blocked } = useRoom();
  const dockRef = useRef(null);
  const stage = tab === 'watch' || tab === 'music' || tab === 'anime';
  const fileVid = Boolean(nowPlaying?.audio_url) && nowPlaying?.kind === 'video';
  const song = Boolean(nowPlaying?.audio_url) && !fileVid;
  const [pos, setPos] = useState(defaultPos); const [dragging, setDragging] = useState(false); const drag = useRef(null); const moved = useRef(false);
  useEffect(() => { const f = () => setPos(p => clampPos(p[0], p[1])); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  // The mini player can be dragged anywhere (finger or mouse); its position is remembered.
  const down = e => { if (stage || e.target.closest('button,a')) return; drag.current = { dx: e.clientX - pos[0], dy: e.clientY - pos[1] }; moved.current = false; setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } };
  const move = e => { const d = drag.current; if (!d) return; moved.current = true; setPos(clampPos(e.clientX - d.dx, e.clientY - d.dy)); };
  const up = () => { if (!drag.current) return; drag.current = null; setDragging(false); setPos(p => { try { localStorage.setItem(MINI_KEY, JSON.stringify(p)); } catch { /* ignore */ } return p; }); };
  const miniStyle = !stage ? { '--mx': `${pos[0]}px`, '--my': `${pos[1]}px` } : undefined;
  return <>
  <div ref={dockRef} style={miniStyle} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
    className={`dock ${stage ? 'dock-stage' : 'dock-mini'} ${dragging ? 'dock-dragging' : ''} ${tab === 'music' ? 'dock-compact' : ''} ${nowPlaying ? '' : 'dock-idle'} ${song ? 'dock-song' : ''} ${fileVid ? 'dock-file' : ''}`}>
    {!stage && nowPlaying && <span className="dock-grip" aria-hidden="true" />}
    <div className="dock-video" ref={setHostEl} />
    {song && <div className="song-stage" style={nowPlaying.thumbnail ? { '--art': `url(${nowPlaying.thumbnail})` } : undefined}><div className={`vinyl ${playing ? 'spin' : ''}`}>{nowPlaying.thumbnail ? <img src={nowPlaying.thumbnail} alt="" /> : <span>♪</span>}</div><div className="song-info"><b>{nowPlaying.title}</b><span>{nowPlaying.channel}</span><span className={`eq big ${playing ? '' : 'paused'}`}><i/><i/><i/><i/><i/></span></div></div>}
    {!nowPlaying && <div className="dock-empty"><PlayCircle size={40}/><b>Nothing playing yet</b><span>{tab === 'music' ? 'Search a song below.' : 'Paste a video link or add a song.'}</span></div>}
    {blocked && nowPlaying && !song && <div className="blocked-overlay"><b>Can’t play this video here</b>{stage && <span className="muted small">{blocked.reason} Looking for another upload…</span>}
      <div className="row tight"><a className="btn primary sm" href={`https://www.youtube.com/watch?v=${blocked.item?.video_id}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> Open on YouTube</a><button className="btn ghost sm" onClick={skip}><SkipForward size={13}/> Skip</button></div></div>}
    {needsTap && !blocked && <button className="tap-overlay" onClick={resumeTap}><Play size={22} fill="currentColor"/> Tap to join the playback</button>}
    {!stage && nowPlaying && <div className="dock-mini-bar">
      <span className="dock-title" title={nowPlaying.title}>{nowPlaying.title}</span>
      <button className="icon-btn sm" onClick={prev} aria-label="Previous"><SkipBack size={15}/></button>
      <button className="icon-btn sm" onClick={togglePlay} disabled={!playerReady && !song} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={15}/> : <Play size={15}/>}</button>
      <button className="icon-btn sm" onClick={skip} aria-label="Next"><SkipForward size={15}/></button>
      <button className="icon-btn sm" onClick={() => navigate(`/room/${roomId}/${nowPlaying.kind === 'video' ? (nowPlaying.audio_url ? 'anime' : 'watch') : 'music'}`)} aria-label="Expand"><Maximize2 size={15}/></button>
    </div>}
  </div>
  {stage && <PlayerControls dockRef={dockRef} />}
  </>;
}

function People() {
  const { participants, room, react } = useRoom();
  const { uid } = useApp();
  return <aside className="room-side glass">
    <h4><Users size={15}/> In the room · {Math.max(1, participants.length)}</h4>
    <div className="people-list">{participants.map(p => <div className="person compact" key={p.user_id}><span className="avatar sm">{initial(p.name)}</span><span>{p.name}{p.user_id === uid ? ' (you)' : ''}</span>{room?.host_id === p.user_id && <span className="chip">host</span>}<i className="presence" /></div>)}
      {participants.length === 0 && <p className="muted">Connecting…</p>}</div>
    <h4>Send a reaction</h4>
    <div className="emoji-row">{EMOJIS.map(e => <button key={e} className="emoji-btn" onClick={() => react(e)}>{e}</button>)}</div>
  </aside>;
}

function Inner({ tab }) {
  const { room, status, roomId, unread, reactions, conn, incomingCall, dismissCall } = useRoom();
  const { toast } = useApp();
  const [callStarted, setCallStarted] = useState(false);
  const [callMode, setCallMode] = useState('video');
  const startCall = m => { setCallMode(['voice', 'video', 'jitsi-voice', 'jitsi-video'].includes(m) ? m : 'video'); setCallStarted(true); navigate(`/room/${roomId}/call`); };
  const valid = TABS.some(([k]) => k === tab) ? tab : 'watch';

  if (status === 'denied') return <div className="page narrow"><div className="glass empty"><h2>Room unavailable</h2><p className="muted">It may have been deleted, or it is private and you are not a member.</p><button className="btn primary" onClick={() => navigate('/rooms')}>Back to rooms</button></div></div>;

  const copy = () => room && navigator.clipboard?.writeText(room.code).then(() => toast(`Invite code ${room.code} copied`, 'love'), () => toast(`Code: ${room.code}`));

  return <div className="page room-page">
    <div className="room-head">
      <button className="icon-btn" onClick={() => navigate('/rooms')} aria-label="Back to rooms"><ArrowLeft size={18}/></button>
      <div><span className="eyebrow">{room?.visibility === 'public' ? 'Public room' : 'Private room'}</span><h1>{room?.name || 'Loading…'}</h1></div>
      <button className="btn ghost sm" onClick={copy} disabled={!room}><Copy size={14}/> {room?.code || '······'}</button>
    </div>
    {conn === 'offline' && <div className="banner warn">Connection lost — reconnecting. Messages will send when you're back.</div>}
    {incomingCall && !callStarted && <div className="banner call"><PhoneCall size={18}/><span><b>{incomingCall.name}</b> is calling ({incomingCall.mode})</span><button className="btn primary sm" onClick={() => { startCall('jitsi-' + String(incomingCall.mode).replace('jitsi-', '')); dismissCall(); }}>Join</button><button className="btn ghost sm" onClick={dismissCall}>Dismiss</button></div>}
    {callStarted && valid !== 'call' && <div className="banner ok"><span className="live-dot"/> In a call <button className="btn ghost sm" onClick={() => navigate(`/room/${roomId}/call`)}>Open</button><button className="btn danger sm" onClick={() => setCallStarted(false)}><PhoneOff size={14}/> Leave</button></div>}
    <nav className="room-tabs" aria-label="Room sections">{TABS.map(([k, label, Icon]) => <button key={k} className={valid === k ? 'on' : ''} onClick={() => navigate(`/room/${roomId}/${k}`)}><Icon size={16}/><span>{label}</span>{k === 'chat' && unread > 0 && valid !== 'chat' && <span className="badge in">{unread}</span>}</button>)}</nav>

    <div className="room-grid">
      <div className="room-main">
        <Dock tab={valid} />
        {valid === 'watch' && <WatchPage />}
        {valid === 'anime' && <AnimePage />}
        {valid === 'music' && <MusicPage />}
        {valid === 'games' && <GamesPage />}
        {valid === 'call' && <CallPage started={callStarted} mode={callMode} onStart={startCall} onLeave={() => setCallStarted(false)} />}
        {valid === 'chat' && <ChatPage />}
        {valid === 'manage' && <ManagePage />}
  {callStarted && <CallPanel key={callMode} mode={callMode} visible={valid === 'call'} onLeave={() => setCallStarted(false)} />}
      </div>
      <People />
    </div>
    <div className="reaction-layer" aria-hidden="true">{reactions.map(r => <span key={r.id} className="float-emoji" style={{ left: `${r.left}%` }}>{r.emoji}<small>{r.name}</small></span>)}</div>
  </div>;
}

export default function RoomLayout({ roomId, tab }) {
  return <RoomProvider roomId={roomId}><Inner tab={tab} /></RoomProvider>;
}
