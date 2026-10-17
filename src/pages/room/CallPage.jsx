import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, FlipHorizontal, Mic, MicOff, Monitor, PhoneCall, PhoneOff, Video } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { useApp } from '../../context/AppContext';
import { initial } from '../../lib/util';

// Own WebRTC mesh call (works on mobile browsers — no Jitsi iframe). Signaling goes over the room's realtime channel.
// STUN is built in; add TURN in .env for strict mobile/office networks (VITE_TURN_URL / _USER / _PASS).
const ICE = { iceCandidatePoolSize: 4, iceServers: [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
  ...(import.meta.env.VITE_TURN_URL ? [{ urls: import.meta.env.VITE_TURN_URL.split(','), username: import.meta.env.VITE_TURN_USER, credential: import.meta.env.VITE_TURN_PASS }] : []),
  // Free public relay so calls connect over mobile data / strict Wi-Fi. For production reliability, set your own VITE_TURN_* in .env.
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
] };

function Tile({ stream, name, muted, mirror, off, share }) {
  const ref = useRef(null); const [stuck, setStuck] = useState(false);
  useEffect(() => { const v = ref.current; if (v && v.srcObject !== stream) { v.srcObject = stream || null; const r = v.play?.(); if (r?.catch) r.catch(() => { if (!muted) setStuck(true); }); } }, [stream, muted]);
  return <div className={`call-tile ${off ? 'cam-off' : ''} ${share ? 'share' : ''}`}>
    <video ref={ref} autoPlay playsInline muted={muted} className={mirror ? 'mirror' : ''} />
    {off && <span className="avatar lg">{initial(name)}</span>}
    {stuck && <button className="tap-overlay" onClick={() => { ref.current?.play().then(() => setStuck(false), () => {}); }}>Tap to hear {name}</button>}
    <span className="tile-name">{share ? `${name} · screen` : name}</span>
  </div>;
}

// Stays mounted while you browse other tabs, so the call is not dropped.
function P2PPanel({ visible, mode, onLeave }) {
  const { signal, subscribeRtc, participants, priv } = useRoom();
  const { uid, toast } = useApp();
  const [remotes, setRemotes] = useState({});
  const [local, setLocal] = useState(null);
  const [micOn, setMicOn] = useState(!priv.muteOnJoin);
  const [camOn, setCamOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [err, setErr] = useState('');
  const [state, setState] = useState('starting');
  const peers = useRef(new Map()); const localRef = useRef(null); const facing = useRef('user');
  const screenTrack = useRef(null); const vsRef = useRef({ cam: false, share: false }); const [rv, setRv] = useState({}); const [preview, setPreview] = useState(null);
  const outQ = useRef([]); const outTimer = useRef(0); const camTrack = useRef(null);

  // Realtime rate limits: space signaling messages out.
  const out = useCallback(msg => { outQ.current.push(msg); if (outTimer.current) return; const pump = () => { const m = outQ.current.shift(); if (!m) { outTimer.current = 0; return; } signal(m); outTimer.current = setTimeout(pump, 90); }; pump(); }, [signal]);

  const videoSender = pc => pc.getTransceivers().find(t => t.receiver?.track?.kind === 'video')?.sender;
  const closePeer = useCallback(id => { const p = peers.current.get(id); if (!p) return; try { p.pc.close(); } catch { /* ignore */ } peers.current.delete(id); setRemotes(r => { const n = { ...r }; delete n[id]; return n; }); }, []);

  const makePeer = useCallback(id => {
    if (peers.current.has(id)) return peers.current.get(id);
    const pc = new RTCPeerConnection(ICE);
    const st = { pc, makingOffer: false, ignoreOffer: false, polite: String(uid) > String(id), pending: [], dcTimer: 0 };
    peers.current.set(id, st);
    localRef.current?.getTracks().forEach(t => pc.addTrack(t, localRef.current));
    // Always keep ONE reusable video slot, so turning the camera or screen share on/off swaps the track
    // (replaceTrack) instead of renegotiating every time — renegotiation glare was what made the share freeze.
    if (!localRef.current?.getVideoTracks().length) { try { pc.addTransceiver('video', { direction: 'sendrecv', streams: localRef.current ? [localRef.current] : [] }); } catch { /* ignore */ } }
    if (screenTrack.current) { const sd = videoSender(pc); sd?.replaceTrack(screenTrack.current).catch(() => {}); }
    pc.ontrack = ({ streams, track }) => { const s = streams[0] || new MediaStream([track]); setRemotes(r => ({ ...r, [id]: s })); track.onunmute = () => setRemotes(r => ({ ...r, [id]: s })); track.onmute = () => setRemotes(r => ({ ...r })); };
    pc.onnegotiationneeded = async () => { try { st.makingOffer = true; await pc.setLocalDescription(); out({ type: 'desc', to: id, description: pc.localDescription }); } catch (e) { console.warn(e); } finally { st.makingOffer = false; } };
    pc.onicecandidate = ({ candidate }) => { if (candidate) out({ type: 'cand', to: id, candidate }); };
    pc.oniceconnectionstatechange = () => {
      clearTimeout(st.dcTimer);
      if (pc.iceConnectionState === 'failed') { try { pc.restartIce(); } catch { /* ignore */ } }
      else if (pc.iceConnectionState === 'disconnected') st.dcTimer = setTimeout(() => { if (pc.iceConnectionState === 'disconnected') { try { pc.restartIce(); } catch { /* ignore */ } } }, 4000);
      if (pc.iceConnectionState === 'closed') closePeer(id);
    };
    return st;
  }, [uid, out, closePeer]);

  // Start: media first, then announce.
  useEffect(() => {
    let dead = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setErr('Calls need a secure (https) page. Open the site over https, or use localhost on this device.'); setState('error'); return; }
      try {
        const wantVideo = mode === 'video' && !priv.camOffOnJoin;
        const audioC = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
        let stream;
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: audioC, video: wantVideo ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false }); }
        catch (e1) {
          if (e1.name === 'NotAllowedError' || !wantVideo) throw e1;
          // Camera busy or constraints rejected (common on phones): keep the call alive with voice only.
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioC, video: false }); toast('Camera could not start — joined with voice. Tap the camera button to retry.', 'warn');
        }
        if (dead) { stream.getTracks().forEach(t => t.stop()); return; }
        stream.getAudioTracks().forEach(t => { t.enabled = !priv.muteOnJoin; });
        localRef.current = stream; setLocal(stream); setCamOn(stream.getVideoTracks().length > 0); camTrack.current = stream.getVideoTracks()[0] || null;
        setState('live'); out({ type: 'hello' }); out({ type: 'vstate', ...vsRef.current });
      } catch (e) {
        setErr(e.name === 'NotAllowedError' ? 'Permission denied. Allow microphone/camera for this site in your browser settings, then try again.' : e.name === 'NotFoundError' ? 'No microphone or camera was found on this device.' : `Could not start the call: ${e.message}`); setState('error');
      }
    })();
    return () => {
      dead = true; out({ type: 'bye' });
      peers.current.forEach(p => { clearTimeout(p.dcTimer); try { p.pc.close(); } catch { /* ignore */ } }); peers.current.clear();
      screenTrack.current?.stop(); screenTrack.current = null;
      localRef.current?.getTracks().forEach(t => t.stop()); localRef.current = null; clearTimeout(outTimer.current); outTimer.current = 0; outQ.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If nobody has connected yet, keep announcing ourselves (a hello can be lost while the other phone is still joining).
  useEffect(() => {
    if (state !== 'live') return; let n = 0;
    const t = setInterval(() => { if (peers.current.size > 0 && Object.keys(remotes).length > 0) return; if (++n > 40) { clearInterval(t); return; } out({ type: 'hello' }); }, 4000);
    return () => clearInterval(t);
  }, [state, remotes, out]);

  // Incoming signaling.
  useEffect(() => subscribeRtc(async m => {
    const id = m.user_id;
    if (!localRef.current) return;
    if (m.type === 'vstate') setRv(r => ({ ...r, [id]: { cam: !!m.cam, share: !!m.share } }));
    else if (m.type === 'hello') { makePeer(id); out({ type: 'here', to: id }); out({ type: 'vstate', to: id, ...vsRef.current }); }
    else if (m.type === 'here') makePeer(id);
    else if (m.type === 'bye') { closePeer(id); setRv(r => { const n = { ...r }; delete n[id]; return n; }); }
    else if (m.type === 'desc') {
      const st = makePeer(id); const pc = st.pc; const d = m.description;
      try {
        const collision = d.type === 'offer' && (st.makingOffer || pc.signalingState !== 'stable');
        st.ignoreOffer = !st.polite && collision; if (st.ignoreOffer) return;
        await pc.setRemoteDescription(d);
        for (const c of st.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        if (d.type === 'offer') { await pc.setLocalDescription(); out({ type: 'desc', to: id, description: pc.localDescription }); }
      } catch (e) { console.warn('rtc desc', e); }
    } else if (m.type === 'cand') {
      const st = peers.current.get(id); if (!st) return;
      if (!st.pc.remoteDescription) st.pending.push(m.candidate); else try { await st.pc.addIceCandidate(m.candidate); } catch (e) { if (!st.ignoreOffer) console.warn('cand', e); }
    }
  }), [subscribeRtc, makePeer, closePeer, out]);

  // Drop peers that left the room.
  useEffect(() => { const ids = new Set(participants.map(p => p.user_id)); [...peers.current.keys()].forEach(id => { if (!ids.has(id)) closePeer(id); }); }, [participants, closePeer]);

  const replaceVideo = async (track, screen = false) => {
    for (const { pc } of peers.current.values()) {
      try {
        const sd = videoSender(pc);
        if (sd) await sd.replaceTrack(track); else if (track) pc.addTrack(track, localRef.current);
        if (track && sd) { const pr = sd.getParameters(); if (!pr.encodings?.length) pr.encodings = [{}]; pr.encodings[0].maxBitrate = screen ? 2500000 : 1200000; if (screen) pr.degradationPreference = 'maintain-resolution'; await sd.setParameters(pr).catch(() => {}); }
      } catch (e) { console.warn('replaceVideo', e); }
    }
  };
  const toggleMic = () => { const t = localRef.current?.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; setMicOn(t.enabled); };
  const toggleCam = async () => {
    try {
      if (camOn) { camTrack.current?.stop(); localRef.current.removeTrack(camTrack.current); camTrack.current = null; setCamOn(false); if (!screenTrack.current) await replaceVideo(null); setLocal(new MediaStream(localRef.current.getTracks())); return; }
      const v = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing.current } }); const t = v.getVideoTracks()[0];
      localRef.current.addTrack(t); camTrack.current = t; if (!screenTrack.current) await replaceVideo(t); setCamOn(true); setLocal(new MediaStream(localRef.current.getTracks()));
    } catch (e) { toast('Camera unavailable: ' + (e.name === 'NotAllowedError' ? 'permission denied' : e.message), 'warn'); }
  };
  const flip = async () => {
    if (!camOn) return; facing.current = facing.current === 'user' ? 'environment' : 'user';
    try { camTrack.current.stop(); const v = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing.current } } }); const t = v.getVideoTracks()[0]; localRef.current.removeTrack(camTrack.current); localRef.current.addTrack(t); camTrack.current = t; if (!screenTrack.current) await replaceVideo(t); setLocal(new MediaStream(localRef.current.getTracks())); }
    catch { toast('Could not switch camera.', 'warn'); }
  };
  const stopShare = useCallback(async () => {
    const t = screenTrack.current; if (!t) return;
    screenTrack.current = null; t.onended = null; try { t.stop(); } catch { /* ignore */ }
    setSharing(false); setPreview(null);
    await replaceVideo(camTrack.current, false); // back to camera, or an empty slot (remote shows avatar, not a frozen frame)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const share = async () => {
    if (screenTrack.current) { await stopShare(); return; }
    try {
      let d;
      if (navigator.mediaDevices?.getDisplayMedia) d = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 }, width: { max: 1920 }, height: { max: 1080 } }, audio: false });
      else {
        // Phone browsers (Android Chrome, iOS Safari) cannot capture the screen. Share the rear camera instead, and point to the app-based backup.
        d = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        toast('Phones can’t share their screen in a browser — sharing your rear camera instead. For real screen share use “Backup call (Jitsi app)”.', 'info');
      }
      const t = d.getVideoTracks()[0]; if (!t) return;
      try { t.contentHint = 'detail'; } catch { /* optional */ }
      screenTrack.current = t; t.onended = () => stopShare();
      setSharing(true); setPreview(new MediaStream([t]));
      await replaceVideo(t, true);
    } catch (e) { if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') toast('Could not start screen share: ' + e.message, 'warn'); }
  };

  // Tell everyone what our video slot currently shows, so their tile switches cleanly (no frozen last frame).
  useEffect(() => { vsRef.current = { cam: camOn, share: sharing }; if (state === 'live') out({ type: 'vstate', ...vsRef.current }); }, [camOn, sharing, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const names = Object.fromEntries(participants.map(p => [p.user_id, p.name]));
  const ids = Object.keys(remotes);
  return <div className={visible ? 'call-panel call-visible' : 'call-panel call-hidden'}>
    {err && <div className="form-msg">{err}</div>}
    {!err && ids.length === 0 && <div className="call-waiting"><span className="ring-pulse"><PhoneCall size={26}/></span><b>Waiting for others to join…</b><small>Tap “Ring room” so everyone gets a notification.</small></div>}
    <div className={`call-grid n${Math.min(ids.length + 1, 6)}`}>
      {ids.map(id => { const v = rv[id]; const hasVid = remotes[id]?.getVideoTracks().some(t => t.readyState === 'live'); return <Tile key={id} stream={remotes[id]} name={names[id] || 'Friend'} share={v?.share} off={v ? !(v.cam || v.share) : !hasVid} />; })}
      <Tile stream={sharing ? preview : local} name="You" muted share={sharing} mirror={!sharing && facing.current === 'user'} off={!camOn && !sharing} />
    </div>
    {state === 'live' && <div className="call-controls">
      <button className={`cbtn ${micOn ? '' : 'off'}`} onClick={toggleMic} aria-label="Mute">{micOn ? <Mic size={20}/> : <MicOff size={20}/>}</button>
      <button className={`cbtn ${camOn ? '' : 'off'}`} onClick={toggleCam} aria-label="Camera">{camOn ? <Camera size={20}/> : <CameraOff size={20}/>}</button>
      <button className="cbtn" onClick={flip} disabled={!camOn} aria-label="Flip camera"><FlipHorizontal size={20}/></button>
      <button className={`cbtn ${sharing ? 'on' : ''}`} onClick={share} aria-label="Share screen"><Monitor size={20}/></button>
      <button className="cbtn end" onClick={onLeave} aria-label="Leave"><PhoneOff size={20}/></button>
    </div>}
  </div>;
}

// Reliable alternative: a hosted Jitsi room embedded in the app (their servers relay media, so it works on any network / phone).
const JITSI_HOSTS = ['meet.ffmuc.net', 'meet.jit.si', 'jitsi.member.fsf.org'];
export function jitsiUrl(host, roomId, name, voice) {
  const room = `LadduWorld${String(roomId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 28)}`;
  const cfg = [`config.prejoinPageEnabled=false`, `config.prejoinConfig.enabled=false`, `config.requireDisplayName=false`, `config.startWithVideoMuted=${voice}`, `config.disableDeepLinking=true`, `config.disableThirdPartyRequests=true`, `interfaceConfig.MOBILE_APP_PROMO=false`, `userInfo.displayName=${encodeURIComponent(JSON.stringify(name || 'Guest'))}`].join('&');
  return `https://${host}/${room}#${cfg}`;
}
function JitsiPanel({ visible, mode, onLeave }) {
  const { roomId } = useRoom(); const { displayName } = useApp();
  const [h, setH] = useState(0); const voice = mode.endsWith('voice'); const url = jitsiUrl(JITSI_HOSTS[h], roomId, displayName, voice);
  return <div className={visible ? 'call-panel call-visible' : 'call-panel call-hidden'}>
    <iframe key={url} title="Call" className="call-frame" src={url} allow="camera; microphone; display-capture; autoplay; fullscreen; speaker-selection" referrerPolicy="no-referrer" />
    {visible && <div className="jitsi-bar"><button className="btn ghost sm" onClick={() => setH(x => (x + 1) % JITSI_HOSTS.length)}>Not loading? Try another server ({JITSI_HOSTS[h]})</button><a className="btn ghost sm" href={url} target="_blank" rel="noopener noreferrer">Open in new tab</a><button className="btn danger sm" onClick={onLeave}><PhoneOff size={14}/> Leave</button></div>}
  </div>;
}
export function CallPanel(props) { return String(props.mode).startsWith('jitsi') ? <JitsiPanel {...props} /> : <P2PPanel {...props} />; }

export default function CallPage({ started, onStart, onLeave, mode }) {
  const { ringRoom, participants, roomId } = useRoom();
  return <section className="glass panel stack call-page">
    <div><span className="eyebrow">Voice & video</span><h2>Talk together</h2></div>
    {!started ? <>
      <p className="muted">Private peer-to-peer calls, encrypted by your browser (WebRTC). Works on phones and laptops. {participants.length > 1 ? `${participants.length - 1} other${participants.length > 2 ? 's are' : ' is'} in the room.` : 'Nobody else is here yet.'}</p>
      <div className="row"><button className="btn primary lg" onClick={() => onStart('jitsi-video')}><Video size={18}/> Video call</button><button className="btn ghost lg" onClick={() => onStart('jitsi-voice')}><Mic size={18}/> Voice call</button></div>
      <p className="muted small">Uses a hosted call server, so it works on mobile data and strict Wi-Fi. Allow camera/microphone when your browser asks. Phone screen share works from the Jitsi app (use “Open in new tab”).</p>
      <details className="muted small"><summary>Direct peer-to-peer call (advanced)</summary><div className="row" style={{ marginTop: 8 }}><button className="btn ghost sm" onClick={() => onStart('video')}><Video size={14}/> P2P video</button><button className="btn ghost sm" onClick={() => onStart('voice')}><Mic size={14}/> P2P voice</button></div></details>
      <p className="muted small">Calls need https (or localhost). On strict mobile networks, add a TURN server in <code>.env</code> — see README.</p>
    </> : <div className="row between"><span className="chip ok">● In {String(mode).endsWith('voice') ? 'voice' : 'video'} call</span><div className="row tight"><button className="btn ghost sm" onClick={() => ringRoom(mode)}><PhoneCall size={14}/> Ring room</button><button className="btn ghost sm" onClick={onLeave}><PhoneOff size={14}/> Leave</button></div></div>}
    <div className="call-slot" />
  </section>;
}