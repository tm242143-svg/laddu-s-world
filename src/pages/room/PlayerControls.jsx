import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { fmtTime } from '../../lib/util';

// Full control bar for the shared player: seek, play/pause, previous/next, volume, fullscreen.
// Seek / play / pause / skip are synced to everyone in the room; volume is only for you.
export default function PlayerControls({ dockRef }) {
  const { nowPlaying, playing, togglePlay, skip, prev, seekTo, getPosition, getDuration, volume, setVolume, playerReady, queue } = useRoom();
  const [pos, setPos] = useState(0); const [dur, setDur] = useState(0); const drag = useRef(false); const [dragVal, setDragVal] = useState(0);
  const isSong = Boolean(nowPlaying?.audio_url);
  const ready = Boolean(nowPlaying) && (isSong || playerReady);

  useEffect(() => {
    if (!nowPlaying) { setPos(0); setDur(0); return; }
    const t = setInterval(() => { if (drag.current) return; setPos(getPosition() || 0); const d = getDuration(); setDur(Number.isFinite(d) ? d : 0); }, 400);
    return () => clearInterval(t);
  }, [nowPlaying, getPosition, getDuration]);

  const shown = drag.current ? dragVal : pos; const max = dur > 0 ? dur : Math.max(1, shown);
  const pct = Math.min(100, (shown / max) * 100);
  const commit = () => { if (!drag.current) return; drag.current = false; seekTo(dragVal); setPos(dragVal); };
  const fs = () => { const el = dockRef?.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen?.(); else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); };
  const VolIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const idx = queue.findIndex(q => q.id === nowPlaying?.queue_id);

  return <div className={`pc ${ready ? '' : 'pc-off'}`} onClick={e => e.stopPropagation()}>
    <div className="pc-seek">
      <span className="pc-time">{fmtTime(shown)}</span>
      <input type="range" className="pc-range" min={0} max={max} step={0.5} value={Math.min(shown, max)} disabled={!ready || dur <= 0} style={{ '--p': `${pct}%` }} aria-label="Seek"
        onChange={e => { drag.current = true; setDragVal(Number(e.target.value)); }}
        onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
      <span className="pc-time">{dur > 0 ? fmtTime(dur) : '--:--'}</span>
    </div>
    <div className="pc-row">
      <div className="pc-vol">
        <button className="icon-btn sm" onClick={() => setVolume(volume === 0 ? 0.8 : 0)} aria-label={volume === 0 ? 'Unmute' : 'Mute'}><VolIcon size={16}/></button>
        <input type="range" className="pc-range pc-vrange" min={0} max={1} step={0.02} value={volume} style={{ '--p': `${volume * 100}%` }} onChange={e => setVolume(Number(e.target.value))} aria-label="Volume" />
      </div>
      <div className="pc-main">
        <button className="icon-btn" onClick={prev} disabled={!ready} aria-label="Previous"><SkipBack size={18}/></button>
        <button className="pc-play" onClick={togglePlay} disabled={!ready} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={22} fill="currentColor"/> : <Play size={22} fill="currentColor"/>}</button>
        <button className="icon-btn" onClick={skip} disabled={!ready} aria-label="Next"><SkipForward size={18}/></button>
      </div>
      <div className="pc-side">
        {queue.length > 0 && idx >= 0 && <span className="muted small pc-count">{idx + 1}/{queue.length}</span>}
        <button className="icon-btn sm" onClick={fs} disabled={!ready} aria-label="Fullscreen"><Maximize2 size={16}/></button>
      </div>
    </div>
  </div>;
}
