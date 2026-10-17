import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { useApp } from './AppContext';
import { loadYouTubeApi } from '../lib/youtube';
import { rowToItem } from '../lib/music';
import { findEmbeddableAlternative } from '../lib/ytsearch';
import { searchYouTube } from '../lib/ytsearch';
import { uuid } from '../lib/util';
import { usePrivacy } from '../lib/privacy';
import { cryptoOk, deriveKey, seal, open } from '../lib/crypto';
import { initGame, applyMove } from '../games/engine';
import { navigate } from '../lib/router';

const Ctx = createContext(null);
export const useRoom = () => useContext(Ctx);

// "Song" here means anything played by the shared media element: audio files AND direct video files (mp4 / webm / HLS).
const isSong = it => Boolean(it && it.audio_url);
// HLS (.m3u8) plays natively on Safari; other browsers load hls.js on demand.
async function attachSrc(a, url, hlsRef) {
  try { hlsRef.current?.destroy?.(); } catch { /* ignore */ } hlsRef.current = null;
  if (/\.m3u8(\?|$)/i.test(url) && !a.canPlayType('application/vnd.apple.mpegurl')) {
    try {
      const { default: Hls } = await import('hls.js');
      if (Hls.isSupported()) { const h = new Hls({ enableWorker: true }); hlsRef.current = h; h.loadSource(url); h.attachMedia(a); return; }
    } catch { /* fall back to plain src */ }
  }
  a.src = url; a.load();
}

export function RoomProvider({ roomId, children }) {
  const { uid, displayName: realName, toast, loadRooms } = useApp();
  const [priv] = usePrivacy();
  const displayName = priv.anonymousPresence ? `Guest ${String(uid || '').slice(0, 4)}` : realName;
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | denied
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [queue, setQueue] = useState([]);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [game, setGame] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [hostEl, setHostEl] = useState(null);
  const [conn, setConn] = useState('connecting'); // connecting | live | offline
  const [typing, setTyping] = useState({});
  const [volume, setVolumeState] = useState(() => { try { const v = parseFloat(localStorage.getItem('lw-vol')); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8; } catch { return 0.8; } });
  const volRef = useRef(volume);
  const [incomingCall, setIncomingCall] = useState(null);
  const [blocked, setBlocked] = useState(null); // video that refuses embedding
  const triedAlt = useRef(new Set());
  const [passphrase, setPassphraseState] = useState(() => { try { return sessionStorage.getItem(`lw-pass:${roomId}`) || ''; } catch { return ''; } });
  const audioRef = useRef(null);
  const hlsRef = useRef(null);
  const hostElRef = useRef(null);
  const outbox = useRef([]);
  const keyRef = useRef(null);
  const nameRef = useRef(displayName);
  const privRef = useRef(priv);
  const rtcSubs = useRef(new Set());
  const typingTimers = useRef({});
  const lastTypingSent = useRef(0);
  nameRef.current = displayName; privRef.current = priv;

  const channelRef = useRef(null);
  const readyRef = useRef(false);
  const playerRef = useRef(null);
  const nowRef = useRef(null);
  const queueRef = useRef([]);
  const gameRef = useRef(null);
  const participantsRef = useRef([]);
  const applyingRef = useRef(false);
  const applyTimer = useRef(0);
  const controllerRef = useRef(null);
  const advanceTimer = useRef(0);
  const pendingLoad = useRef(null);
  const lastPos = useRef({ pos: 0, t: Date.now() });
  const roomRef = useRef(null);
  const chatOpenRef = useRef(false);
  const uidRef = useRef(uid);
  uidRef.current = uid; queueRef.current = queue; gameRef.current = game; participantsRef.current = participants; roomRef.current = room;

  const isHost = Boolean(room && uid && room.host_id === uid);

  const send = useCallback((event, payload = {}) => {
    const ch = channelRef.current;
    const body = { ...payload, user_id: uidRef.current, sent_at: Date.now() };
    // Chat is never silently dropped: if the channel is still connecting, keep it and flush when live.
    if (!ch || !readyRef.current) { if (event === 'chat') outbox.current.push([event, body]); return; }
    ch.send({ type: 'broadcast', event, payload: body });
  }, []);

  const markApplying = () => { applyingRef.current = true; clearTimeout(applyTimer.current); applyTimer.current = setTimeout(() => { applyingRef.current = false; }, 1100); };

  /* ---------------- player: <audio> for songs, YouTube iframe for videos ---------------- */
  const engine = useCallback(() => {
    const it = nowRef.current;
    if (isSong(it)) {
      const a = audioRef.current; if (!a) return null;
      return { kind: 'audio', pos: () => a.currentTime || 0, state: () => (a.paused ? (a.ended ? 0 : 2) : (a.readyState < 3 ? 3 : 1)),
        play: () => { const r = a.play(); if (r?.catch) r.catch(() => setNeedsTap(true)); }, pause: () => a.pause(), seek: t => { try { a.currentTime = Math.max(0, t); } catch { /* not ready */ } } };
    }
    const p = playerRef.current; if (!p?.getCurrentTime) return null;
    return { kind: 'yt', pos: () => p.getCurrentTime() || 0, state: () => p.getPlayerState(), play: () => p.playVideo(), pause: () => p.pauseVideo(), seek: t => p.seekTo(t, true) };
  }, []);

  const armTapCheck = useCallback(() => {
    setTimeout(() => {
      const e = engine();
      if (nowRef.current && e?.kind === 'yt') { const st = e.state(); if (st !== 1 && st !== 3 && st !== 2) setNeedsTap(true); }
    }, 2600);
  }, [engine]);

  const applyVolume = useCallback(() => { const v = volRef.current; try { if (audioRef.current) audioRef.current.volume = v; const y = playerRef.current; if (y?.setVolume) { y.setVolume(Math.round(v * 100)); v === 0 ? y.mute?.() : y.unMute?.(); } } catch { /* ignore */ } }, []);
  const setVolume = useCallback(v => { const n = Math.min(1, Math.max(0, v)); volRef.current = n; setVolumeState(n); try { localStorage.setItem('lw-vol', String(n)); } catch { /* ignore */ } applyVolume(); }, [applyVolume]);
  const loadItem = useCallback((item, { position = 0, play = true, broadcast = true } = {}) => {
    setBlocked(null); nowRef.current = item; setNowPlaying(item); clearTimeout(advanceTimer.current); markApplying(); applyVolume();
    const yt = playerRef.current; const a = audioRef.current;
    if (isSong(item)) {
      try { yt?.pauseVideo?.(); } catch { /* ignore */ }
      if (a) {
        const start = () => { if (position > 0.5) { try { a.currentTime = position; } catch { /* ignore */ } } if (play) { const r = a.play(); if (r?.catch) r.catch(() => setNeedsTap(true)); } };
        a.addEventListener('loadedmetadata', start, { once: true }); attachSrc(a, item.audio_url, hlsRef);
      }
    } else {
      try { a?.pause(); } catch { /* ignore */ }
      if (yt?.loadVideoById) {
        if (play) yt.loadVideoById({ videoId: item.video_id, startSeconds: Math.max(0, position) });
        else yt.cueVideoById({ videoId: item.video_id, startSeconds: Math.max(0, position) });
      } else pendingLoad.current = { item, position, play };
    }
    if (broadcast) { controllerRef.current = uidRef.current; send('player', { action: 'load', item, position, playing: play }); }
    if (play) armTapCheck();
  }, [send, armTapCheck, applyVolume]);

  const advance = useCallback(() => {
    const q = queueRef.current;
    const idx = q.findIndex(i => i.id === nowRef.current?.queue_id);
    const next = q[idx + 1] || (idx === -1 ? q[0] : null);
    if (next) loadItem(rowToItem(next)); else setPlaying(false);
  }, [loadItem]);

  const scheduleAdvance = useCallback(() => {
    clearTimeout(advanceTimer.current);
    const delay = controllerRef.current === uidRef.current ? 0 : roomRef.current?.host_id === uidRef.current ? 2500 : 5500;
    advanceTimer.current = setTimeout(advance, delay);
  }, [advance]);

  // Audio element for songs (lives as long as the room layout, so music continues across pages).
  useEffect(() => {
    const a = document.createElement('video'); a.className = 'file-video'; a.preload = 'auto'; a.volume = volRef.current; a.setAttribute('playsinline', ''); a.playsInline = true; a.controls = false; audioRef.current = a; if (hostElRef.current) hostElRef.current.appendChild(a);
    const live = () => isSong(nowRef.current);
    const onPlay = () => { if (!live()) return; setPlaying(true); setNeedsTap(false); if (!applyingRef.current) { controllerRef.current = uidRef.current; send('player', { action: 'play', position: a.currentTime }); } };
    const onPause = () => { if (!live() || a.ended) return; setPlaying(false); if (!applyingRef.current) { controllerRef.current = uidRef.current; send('player', { action: 'pause', position: a.currentTime }); } };
    const onEnd = () => { if (!live()) return; setPlaying(false); scheduleAdvance(); };
    const onErr = async () => {
      if (!live() || !a.getAttribute('src')) return; const it = nowRef.current;
      // Dead audio link: look for the same song on YouTube once, otherwise skip.
      if (!triedAlt.current.has(it.video_id) && it.provider !== 'local' && it.kind !== 'video') {
        triedAlt.current.add(it.video_id);
        try { const alt = (await searchYouTube(`${it.title} ${it.channel || ''} song`, 8)).find(v => !v.duration || (v.duration > 90 && v.duration < 900)); if (alt && nowRef.current?.video_id === it.video_id) { toast('That link failed — playing the YouTube version instead.', 'info'); loadItem({ ...alt, queue_id: it.queue_id, title: it.title, kind: 'video' }); return; } } catch { /* fall through */ }
      }
      toast(it.kind === 'video' ? 'This video link could not be played (blocked, expired, or not a direct video file).' : 'That song could not be played — skipping.', 'warn'); scheduleAdvance();
    };
    a.addEventListener('play', onPlay); a.addEventListener('pause', onPause); a.addEventListener('ended', onEnd); a.addEventListener('error', onErr);
    return () => { ['play', 'pause', 'ended', 'error'].forEach((ev, i) => a.removeEventListener(ev, [onPlay, onPause, onEnd, onErr][i])); a.pause(); a.removeAttribute('src'); try { hlsRef.current?.destroy?.(); } catch { /* ignore */ } hlsRef.current = null; a.remove(); audioRef.current = null; };
  }, [send, scheduleAdvance, toast, loadItem]);

  useEffect(() => { hostElRef.current = hostEl; const a = audioRef.current; if (hostEl && a && a.parentNode !== hostEl) hostEl.appendChild(a); }, [hostEl]);

  // YouTube player (videos only).
  useEffect(() => {
    if (!hostEl) return;
    let cancelled = false; let player;
    loadYouTubeApi().then(YT => {
      if (cancelled) return;
      const mount = document.createElement('div'); hostEl.appendChild(mount);
      player = new YT.Player(mount, {
        width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, enablejsapi: 1, origin: window.location.origin, controls: 1 },
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current = player; setPlayerReady(true); applyVolume();
            if (pendingLoad.current) { const { item, position, play } = pendingLoad.current; pendingLoad.current = null; loadItem(item, { position, play, broadcast: false }); }
          },
          onStateChange: e => {
            if (isSong(nowRef.current)) return;
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) { setPlaying(true); setNeedsTap(false); if (!applyingRef.current) { controllerRef.current = uidRef.current; send('player', { action: 'play', position: player.getCurrentTime() }); } }
            else if (e.data === S.PAUSED) { setPlaying(false); if (!applyingRef.current) { controllerRef.current = uidRef.current; send('player', { action: 'pause', position: player.getCurrentTime() }); } }
            else if (e.data === S.ENDED) { setPlaying(false); scheduleAdvance(); }
          },
          onError: e => {
            if (isSong(nowRef.current)) return;
            const it = nowRef.current; const embedBlocked = e.data === 101 || e.data === 150;
            setBlocked({ item: it, reason: embedBlocked ? 'The owner of this video does not allow it to be played outside YouTube.' : 'This video could not be played.' });
            // Auto-try another upload of the same title; if none, the overlay offers "Open on YouTube" / "Skip".
            if (it && !triedAlt.current.has(it.video_id)) { triedAlt.current.add(it.video_id); findEmbeddableAlternative(it.title, it.video_id).then(alt => { if (alt && nowRef.current?.video_id === it.video_id) { setBlocked(null); toast('Original blocks embedding — playing another upload.', 'info'); loadItem({ ...alt, title: it.title, queue_id: it.queue_id }); } }).catch(() => {}); }
          },
        },
      });
    }).catch(err => toast(err.message, 'warn'));
    return () => { cancelled = true; clearTimeout(advanceTimer.current); try { player?.destroy?.(); } catch { /* ignore */ } playerRef.current = null; setPlayerReady(false); };
  }, [hostEl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Controller heartbeat + local seek detection.
  useEffect(() => {
    let tick = 0;
    const timer = setInterval(() => {
      const e = engine(); if (!e || !nowRef.current) return;
      const st = e.state(); const pos = e.pos(); tick++;
      if (st === 1 && !applyingRef.current) {
        const expected = lastPos.current.pos + (Date.now() - lastPos.current.t) / 1000;
        if (Math.abs(pos - expected) > 2.2) { controllerRef.current = uidRef.current; send('player', { action: 'seek', position: pos, playing: true }); }
      }
      lastPos.current = { pos, t: Date.now() };
      if (controllerRef.current === uidRef.current && (st === 1 || st === 2) && tick % 3 === 0) send('player', { action: 'heartbeat', item: nowRef.current, position: pos, playing: st === 1 });
    }, 1000);
    return () => clearInterval(timer);
  }, [send, engine]);

  const handlePlayerEvent = useCallback(payload => {
    controllerRef.current = payload.user_id;
    const latency = payload.playing ? Math.min(3, Math.max(0, (Date.now() - payload.sent_at) / 1000)) : 0;
    const pos = Number(payload.position) || 0;
    if (payload.action === 'load' && payload.item) {
      const cur = nowRef.current; const e0 = engine();
      if (cur && payload.item.queue_id && cur.queue_id === payload.item.queue_id && cur.video_id === payload.item.video_id && Math.abs((e0?.pos() || 0) - pos) < 3) return;
      loadItem(payload.item, { position: pos + latency, play: payload.playing !== false, broadcast: false });
      return;
    }
    if (payload.action === 'heartbeat' && payload.item && (!nowRef.current || nowRef.current.video_id !== payload.item.video_id)) {
      loadItem(payload.item, { position: pos + latency, play: payload.playing, broadcast: false }); return;
    }
    const e = engine(); if (!e) return;
    markApplying();
    const drift = Math.abs(e.pos() - (pos + latency));
    if (payload.action === 'play') { if (drift > 1) e.seek(pos + latency); e.play(); armTapCheck(); }
    else if (payload.action === 'pause') { e.pause(); if (drift > 1) e.seek(pos); }
    else if (payload.action === 'seek') e.seek(pos + latency);
    else if (payload.action === 'heartbeat') {
      if (drift > 2) e.seek(pos + latency);
      const st = e.state();
      if (payload.playing && st !== 1 && st !== 3) { e.play(); armTapCheck(); } else if (!payload.playing && st === 1) e.pause();
    }
  }, [loadItem, armTapCheck, engine]);

  const playNow = useCallback(item => loadItem(item), [loadItem]);
  const togglePlay = useCallback(() => { const e = engine(); if (!e) return; if (e.state() === 1) e.pause(); else e.play(); }, [engine]);
  const resumeTap = useCallback(() => { engine()?.play(); setNeedsTap(false); }, [engine]);
  const skip = useCallback(() => { clearTimeout(advanceTimer.current); controllerRef.current = uidRef.current; advance(); }, [advance]);
  const prev = useCallback(() => {
    const q = queueRef.current; const idx = q.findIndex(i => i.id === nowRef.current?.queue_id);
    // Restart the song if we're past 4s (like every music app), otherwise go to the previous one.
    const e = engine(); if (e && e.pos() > 4) { markApplying(); e.seek(0); controllerRef.current = uidRef.current; send('player', { action: 'seek', position: 0, playing: e.state() === 1 }); return; }
    if (idx > 0) { clearTimeout(advanceTimer.current); loadItem(rowToItem(q[idx - 1])); }
  }, [engine, loadItem, send]);
  const seekTo = useCallback(t => { const e = engine(); if (!e) return; markApplying(); e.seek(t); controllerRef.current = uidRef.current; send('player', { action: 'seek', position: t, playing: e.state() === 1 }); }, [engine, send]);
  const getPosition = useCallback(() => engine()?.pos() || 0, [engine]);
  const getDuration = useCallback(() => (isSong(nowRef.current) ? (audioRef.current?.duration || nowRef.current?.duration || 0) : (playerRef.current?.getDuration?.() || 0)), []);

  /* ---------------- queue ---------------- */
  const loadQueue = useCallback(async () => {
    const { data, error } = await supabase.from('room_queue').select('*').eq('room_id', roomId).order('position', { ascending: true });
    if (!error) setQueue(data || []);
  }, [roomId]);

  const addToQueue = useCallback(async (song, { playIfIdle = true } = {}) => {
    const { data, error } = await supabase.from('room_queue').insert({
      room_id: roomId, video_id: song.video_id, title: song.title, channel: song.channel || song.artist || null,
      thumbnail: song.thumbnail || (song.audio_url ? null : `https://i.ytimg.com/vi/${song.video_id}/mqdefault.jpg`), kind: song.kind || 'song', added_by: uidRef.current, added_by_name: displayName,
      ...(song.audio_url ? { audio_url: song.audio_url, provider: song.provider || null } : {}),
    }).select().single();
    if (error) { toast(/audio_url|provider|check/i.test(error.message) ? 'Run supabase/upgrade-v3.sql once to enable songs.' : error.message, 'warn'); return; }
    setQueue(q => q.some(x => x.id === data.id) ? q : [...q, data]);
    toast(`Added “${song.title.slice(0, 40)}”`, 'love');
    if (playIfIdle && !nowRef.current) loadItem(rowToItem(data));
  }, [roomId, displayName, loadItem, toast]);

  const removeFromQueue = useCallback(async id => {
    setQueue(q => q.filter(x => x.id !== id));
    const { error } = await supabase.from('room_queue').delete().eq('id', id);
    if (error) { toast(error.message, 'warn'); loadQueue(); }
  }, [loadQueue, toast]);

  const clearQueue = useCallback(async () => {
    const { error } = await supabase.from('room_queue').delete().eq('room_id', roomId);
    if (error) toast('Only the host can clear everything. Remove your own songs instead.', 'warn'); else setQueue([]);
  }, [roomId, toast]);

  /* ---------------- chat / reactions ---------------- */
  const sendChat = useCallback(async body => {
    const text = String(body || '').trim().slice(0, 1000); if (!text) return;
    const id = uuid(); const created_at = new Date().toISOString();
    const local = { id, user_id: uidRef.current, name: nameRef.current, body: text, created_at, status: 'sending' };
    setMessages(m => [...m.slice(-199), local]);
    let wire = { id, user_id: uidRef.current, name: nameRef.current, body: text, created_at };
    try { if (privRef.current.encryptChat && keyRef.current) wire = { ...wire, body: await seal(await keyRef.current, text), enc: true }; } catch { /* send plain if crypto fails */ }
    send('chat', wire);
    setMessages(m => m.map(x => x.id === id ? { ...x, status: readyRef.current ? 'sent' : 'queued' } : x));
  }, [send]);
  const setChatOpen = useCallback(open => { chatOpenRef.current = open; if (open) setUnread(0); }, []);
  const sendTyping = useCallback(() => {
    if (privRef.current.hideTyping || Date.now() - lastTypingSent.current < 1800) return;
    lastTypingSent.current = Date.now(); send('typing', { name: nameRef.current });
  }, [send]);
  const setPassphrase = useCallback(v => { setPassphraseState(v); try { v ? sessionStorage.setItem(`lw-pass:${roomId}`, v) : sessionStorage.removeItem(`lw-pass:${roomId}`); } catch { /* ignore */ } }, [roomId]);
  const clearChat = useCallback(() => setMessages([]), []);
  const signal = useCallback(payload => send('rtc', payload), [send]);
  const subscribeRtc = useCallback(fn => { rtcSubs.current.add(fn); return () => rtcSubs.current.delete(fn); }, []);
  const ringRoom = useCallback(mode => { send('ring', { name: nameRef.current, mode }); toast('Ringing the room 📞', 'love'); }, [send, toast]);
  const dismissCall = useCallback(() => setIncomingCall(null), []);

  // Key for chat encryption: derived from the room code (+ optional shared passphrase).
  useEffect(() => {
    if (!room?.code || !cryptoOk()) { keyRef.current = null; return; }
    keyRef.current = deriveKey(`${room.code}:${passphrase}`, roomId).catch(() => null);
  }, [room?.code, passphrase, roomId]);

  // Wipe on-screen chat when leaving the room (privacy option).
  // Messages live only in memory (never in the database). Leaving the room deletes them on this device AND,
  // via a broadcast, removes the leaver's messages from everyone else's screen.
  useEffect(() => {
    const bye = () => { try { send('chat_gone', { user_id: uidRef.current }); } catch { /* ignore */ } };
    window.addEventListener('pagehide', bye);
    return () => { window.removeEventListener('pagehide', bye); bye(); setMessages([]); setUnread(0); try { sessionStorage.removeItem(`lw-pass:${roomId}`); } catch { /* ignore */ } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Optional auto-delete timer (Settings → Messages).
  useEffect(() => {
    const t = setInterval(() => { const ttl = privRef.current.chatTtl; if (!ttl) return; const cut = Date.now() - ttl * 60000; setMessages(m => { const n = m.filter(x => new Date(x.created_at).getTime() > cut); return n.length === m.length ? m : n; }); }, 10000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { channelRef.current?.track?.({ user_id: uid, name: displayName, online_at: new Date().toISOString() }).catch?.(() => {}); }, [displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushReaction = useCallback((emoji, name) => {
    const id = Math.random().toString(36).slice(2);
    setReactions(r => [...r.slice(-24), { id, emoji, left: 8 + Math.random() * 84, name }]);
    window.dispatchEvent(new CustomEvent('lw-react', { detail: { emoji } }));
    setTimeout(() => setReactions(r => r.filter(x => x.id !== id)), 3200);
  }, []);
  const react = useCallback(emoji => { pushReaction(emoji, displayName); send('react', { emoji, name: displayName }); }, [pushReaction, send, displayName]);

  /* ---------------- games ---------------- */
  const publishGame = useCallback(g => { setGame(g); send('game', { game: g }); }, [send]);
  const startGame = useCallback(type => publishGame({ type, seats: [null, null], v: (gameRef.current?.v || 0) + 1, by: uidRef.current, state: initGame(type) }), [publishGame]);
  const takeSeat = useCallback(i => {
    const g = gameRef.current; if (!g || g.seats[i] || g.seats.some(s => s?.id === uidRef.current)) return;
    const seats = g.seats.slice(); seats[i] = { id: uidRef.current, name: displayName };
    publishGame({ ...g, seats, v: g.v + 1, by: uidRef.current });
  }, [publishGame, displayName]);
  const playMove = useCallback(move => {
    const g = gameRef.current; if (!g) return;
    const seat = g.seats.findIndex(s => s?.id === uidRef.current);
    if (g.seats.some(s => !s)) return;
    const next = applyMove(g.state, move, seat); if (!next) return;
    publishGame({ ...g, state: next, v: g.v + 1, by: uidRef.current });
  }, [publishGame]);
  const rematch = useCallback(() => { const g = gameRef.current; if (g) publishGame({ ...g, state: initGame(g.type), v: g.v + 1, by: uidRef.current }); }, [publishGame]);
  const closeGame = useCallback(() => { setGame(null); send('game', { game: null, close: true }); }, [send]);

  /* ---------------- room load + channel ---------------- */
  const loadRoom = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (!data) { setStatus('denied'); return null; }
    setRoom(data); setStatus('ready'); return data;
  }, [roomId]);

  useEffect(() => {
    if (!uid) return;
    let disposed = false; let channel = null; let qch = null;
    setRoom(null); setStatus('loading'); setMessages([]); setQueue([]); setNowPlaying(null); nowRef.current = null; setGame(null); setParticipants([]); setConn('connecting');
    (async () => {
      const r = await loadRoom(); if (!r || disposed) return;
      if (r.host_id !== uid) await supabase.from('room_members').insert({ room_id: roomId, user_id: uid }).then(() => {}, () => {});
      loadRooms(); loadQueue();
    })();

    // Deferred by one tick: React StrictMode mounts → unmounts → mounts effects instantly, and removing a channel
    // while an identical topic is being joined can kill the new one (messages silently stop). This avoids it.
    const boot = setTimeout(() => {
      if (disposed) return;
      channel = supabase.channel(`room:${roomId}`, { config: { broadcast: { self: false, ack: false }, presence: { key: uid } } });
      channelRef.current = channel;
      const isResponder = () => { const ids = participantsRef.current.map(p => p.user_id).sort(); return ids[0] === uidRef.current; };
      channel
        .on('broadcast', { event: 'player' }, ({ payload }) => { if (payload && payload.user_id !== uidRef.current) handlePlayerEvent(payload); })
        .on('broadcast', { event: 'player-request' }, () => {
          const e = engine(); if (!isResponder() || !nowRef.current || !e) return;
          send('player', { action: 'load', item: nowRef.current, position: e.pos(), playing: e.state() === 1 });
        })
        .on('broadcast', { event: 'chat_gone' }, ({ payload }) => { if (payload?.user_id && payload.user_id !== uidRef.current) setMessages(m => m.filter(x => x.user_id !== payload.user_id)); })
        .on('broadcast', { event: 'chat' }, async ({ payload }) => {
          if (!payload || payload.user_id === uidRef.current) return;
          let body = payload.body;
          if (payload.enc) { try { body = await open(await keyRef.current, payload.body); } catch { body = '🔒 Could not decrypt (different room passphrase?)'; } }
          setMessages(m => m.some(x => x.id === payload.id) ? m : [...m.slice(-199), { id: payload.id, user_id: payload.user_id, name: String(payload.name || 'Someone').slice(0, 40), body: String(body).slice(0, 1000), created_at: payload.created_at, enc: Boolean(payload.enc) }]);
          setTyping(t => { const n = { ...t }; delete n[payload.user_id]; return n; });
          if (!chatOpenRef.current) setUnread(n => n + 1);
          if (privRef.current.sounds && !chatOpenRef.current) { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = 0.04; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.12); setTimeout(() => c.close(), 400); } catch { /* ignore */ } }
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (!payload || payload.user_id === uidRef.current) return;
          setTyping(t => ({ ...t, [payload.user_id]: String(payload.name || 'Someone').slice(0, 40) }));
          clearTimeout(typingTimers.current[payload.user_id]);
          typingTimers.current[payload.user_id] = setTimeout(() => setTyping(t => { const n = { ...t }; delete n[payload.user_id]; return n; }), 3200);
        })
        .on('broadcast', { event: 'rtc' }, ({ payload }) => { if (payload && payload.user_id !== uidRef.current && (!payload.to || payload.to === uidRef.current)) rtcSubs.current.forEach(fn => fn(payload)); })
        .on('broadcast', { event: 'ring' }, ({ payload }) => { if (payload && payload.user_id !== uidRef.current) { setIncomingCall({ name: String(payload.name || 'Someone').slice(0, 40), mode: payload.mode === 'voice' ? 'voice' : 'video', at: Date.now() }); toast(`📞 ${payload.name || 'Someone'} is calling`, 'love'); } })
        .on('broadcast', { event: 'react' }, ({ payload }) => { if (payload?.emoji) pushReaction(String(payload.emoji).slice(0, 4), String(payload.name || '').slice(0, 40)); })
        .on('broadcast', { event: 'game' }, ({ payload }) => {
          if (!payload || payload.user_id === uidRef.current) return;
          if (payload.close) { setGame(null); return; }
          const g = payload.game, cur = gameRef.current;
          if (!g) return;
          if (!cur || g.v > cur.v || (g.v === cur.v && String(g.by) > String(cur.by))) setGame(g);
        })
        .on('broadcast', { event: 'game-request' }, () => { if (gameRef.current && isResponder()) send('game', { game: gameRef.current }); })
        .on('broadcast', { event: 'kick' }, ({ payload }) => { if (payload?.target === uidRef.current) { toast('You were removed from this room.', 'warn'); loadRooms(); navigate('/rooms'); } })
        .on('broadcast', { event: 'room-updated' }, () => { loadRoom(); loadRooms(); })
        .on('presence', { event: 'sync' }, () => setParticipants(Object.values(channel.presenceState()).flat().filter(Boolean)))
        .subscribe(async s => {
          if (disposed) return;
          if (s === 'SUBSCRIBED') {
            readyRef.current = true; setConn('live');
            await channel.track({ user_id: uid, name: nameRef.current, online_at: new Date().toISOString() });
            send('player-request'); send('game-request');
            const pending = outbox.current.splice(0); pending.forEach(([ev, p]) => channel.send({ type: 'broadcast', event: ev, payload: p }));
            setMessages(m => m.map(x => x.status === 'queued' ? { ...x, status: 'sent' } : x));
          } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') { readyRef.current = false; setConn('offline'); }
        });

      qch = supabase.channel(`queue:${roomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_queue', filter: `room_id=eq.${roomId}` }, () => loadQueue())
        .subscribe();
    }, 0);

    return () => {
      disposed = true; clearTimeout(boot); readyRef.current = false; channelRef.current = null;
      if (channel) supabase.removeChannel(channel); if (qch) supabase.removeChannel(qch);
    };
  }, [roomId, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- manage ---------------- */
  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from('room_members').select('user_id,role,joined_at').eq('room_id', roomId);
    const ids = [...new Set([...(data || []).map(m => m.user_id), roomRef.current?.host_id].filter(Boolean))];
    const names = {};
    if (ids.length) (await supabase.from('profiles').select('id,display_name').in('id', ids)).data?.forEach(p => { names[p.id] = p.display_name; });
    const list = (data || []).filter(m => m.user_id !== roomRef.current?.host_id).map(m => ({ ...m, name: names[m.user_id] || 'Member' }));
    return [{ user_id: roomRef.current?.host_id, role: 'host', name: names[roomRef.current?.host_id] || 'Host' }, ...list];
  }, [roomId]);
  const kick = useCallback(async userId => {
    const { error } = await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
    if (error) { toast(error.message, 'warn'); return false; }
    send('kick', { target: userId }); return true;
  }, [roomId, send, toast]);
  const updateRoom = useCallback(async patch => {
    const { error } = await supabase.from('rooms').update(patch).eq('id', roomId);
    if (error) { toast(error.message, 'warn'); return false; }
    await loadRoom(); loadRooms(); send('room-updated'); return true;
  }, [roomId, loadRoom, loadRooms, send, toast]);

  const value = useMemo(() => ({
    roomId, room, status, isHost, participants, messages, unread, setChatOpen, sendChat,
    queue, addToQueue, removeFromQueue, clearQueue, nowPlaying, playing, playerReady, needsTap, resumeTap, playNow, togglePlay, skip, prev, volume, setVolume,
    setHostEl, reactions, react, conn, typing, sendTyping, passphrase, setPassphrase, clearChat, signal, subscribeRtc, ringRoom, incomingCall, dismissCall, blocked, setBlocked, seekTo, getPosition, getDuration, priv, game, startGame, takeSeat, playMove, rematch, closeGame, loadMembers, kick, updateRoom, loadRoom,
  }), [blocked, conn, typing, sendTyping, passphrase, setPassphrase, clearChat, signal, subscribeRtc, ringRoom, incomingCall, dismissCall, seekTo, getPosition, getDuration, priv, roomId, room, status, isHost, participants, messages, unread, setChatOpen, sendChat, queue, addToQueue, removeFromQueue, clearQueue,
    nowPlaying, playing, playerReady, needsTap, resumeTap, playNow, togglePlay, skip, prev, volume, setVolume, reactions, react, game, startGame, takeSeat, playMove, rematch, closeGame, loadMembers, kick, updateRoom, loadRoom]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
