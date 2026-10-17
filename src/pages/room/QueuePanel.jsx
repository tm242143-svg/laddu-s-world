import React from 'react';
import { ListMusic, Play, Trash2, Music2, Youtube } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { useApp } from '../../context/AppContext';
import { rowToItem } from '../../lib/music';

export default function QueuePanel() {
  const { queue, nowPlaying, playNow, removeFromQueue, clearQueue, isHost } = useRoom();
  const { uid } = useApp();
  return <section className="glass panel queue">
    <div className="section-head tight"><h3><ListMusic size={18}/> Room queue · {queue.length}</h3>{isHost && queue.length > 0 && <button className="link-btn" onClick={() => window.confirm('Clear the whole queue?') && clearQueue()}>Clear</button>}</div>
    {queue.length === 0 && <p className="muted">Nothing queued. Add songs or videos — everyone in the room can add.</p>}
    <ol className="queue-list">{queue.map(q => {
      const current = nowPlaying?.queue_id === q.id;
      return <li key={q.id} className={current ? 'current' : ''}>
        {q.thumbnail ? <img src={q.thumbnail} alt="" loading="lazy" /> : <span className="song-ph">♪</span>}
        <div className="q-meta"><b title={q.title}>{q.title}</b><span className="muted">{q.kind === 'video' ? <Youtube size={12}/> : <Music2 size={12}/>} {q.added_by_name || 'Someone'}</span></div>
        {current ? <span className="eq" aria-label="Now playing"><i/><i/><i/></span> : <button className="icon-btn sm" onClick={() => playNow(rowToItem(q))} aria-label="Play now"><Play size={14}/></button>}
        {(q.added_by === uid || isHost) && <button className="icon-btn sm danger" onClick={() => removeFromQueue(q.id)} aria-label="Remove"><Trash2 size={14}/></button>}
      </li>;
    })}</ol>
  </section>;
}
