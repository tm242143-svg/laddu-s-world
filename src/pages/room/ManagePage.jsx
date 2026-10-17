import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Globe, LogOut, Lock, RefreshCw, Trash2, UserMinus } from 'lucide-react';
import { supabase } from '../../supabase';
import { useRoom } from '../../context/RoomContext';
import { useApp } from '../../context/AppContext';
import { navigate } from '../../lib/router';
import { makeCode, initial } from '../../lib/util';

export default function ManagePage() {
  const { room, roomId, isHost, loadMembers, kick, updateRoom, loadRoom } = useRoom();
  const { uid, toast, loadRooms } = useApp();
  const [name, setName] = useState(room?.name || '');
  const [members, setMembers] = useState([]);
  useEffect(() => { setName(room?.name || ''); }, [room?.name]);
  const refresh = useCallback(async () => setMembers(await loadMembers()), [loadMembers]);
  useEffect(() => { if (room) refresh(); }, [room?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!room) return null;
  const copy = () => navigator.clipboard?.writeText(room.code).then(() => toast(`Code ${room.code} copied`, 'love'), () => toast(`Code: ${room.code}`));
  const newCode = async () => {
    const { error } = await supabase.rpc('regenerate_room_code', { p_room_id: roomId, p_code: makeCode() });
    if (error) toast(error.message.includes('regenerate') ? 'Run supabase/upgrade-v2.sql first.' : error.message, 'warn'); else { await loadRoom(); loadRooms(); toast('New invite code created'); }
  };
  const leave = async () => {
    if (!window.confirm('Leave this room?')) return;
    const { error } = await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', uid);
    if (error) toast(error.message, 'warn'); else { await loadRooms(); navigate('/rooms'); }
  };
  const del = async () => {
    if (!window.confirm(`Delete “${room.name}” for everyone?`)) return;
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) toast(error.message, 'warn'); else { await loadRooms(); navigate('/rooms'); }
  };

  return <div className="stack gap">
    <section className="glass panel stack">
      <div><span className="eyebrow">Room settings</span><h2>{isHost ? 'Manage this room' : 'About this room'}</h2></div>
      <div className="row between"><span>Invite code <b className="code">{room.code}</b></span><div className="row tight"><button className="btn ghost sm" onClick={copy}><Copy size={14}/> Copy</button>{isHost && <button className="btn ghost sm" onClick={newCode}><RefreshCw size={14}/> New code</button>}</div></div>
      {isHost && <>
        <form className="url-form" onSubmit={async e => { e.preventDefault(); if (name.trim() && await updateRoom({ name: name.trim() })) toast('Room renamed', 'love'); }}>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} aria-label="Room name" /><button className="btn primary" disabled={!name.trim() || name.trim() === room.name}>Rename</button></form>
        <div className="seg"><button className={room.visibility === 'private' ? 'on' : ''} onClick={() => updateRoom({ visibility: 'private' })}><Lock size={14}/> Private</button><button className={room.visibility === 'public' ? 'on' : ''} onClick={() => updateRoom({ visibility: 'public' })}><Globe size={14}/> Public</button></div>
      </>}
    </section>
    <section className="glass panel stack">
      <h3>Members · {members.length}</h3>
      {members.map(m => <div className="person" key={m.user_id}><span className="avatar">{initial(m.name)}</span><b>{m.name}{m.user_id === uid ? ' (you)' : ''}</b>{m.role === 'host' ? <span className="chip">host</span> : isHost && <button className="btn ghost sm" onClick={async () => { if (window.confirm(`Remove ${m.name}?`) && await kick(m.user_id)) { toast(`${m.name} removed`); refresh(); } }}><UserMinus size={14}/> Remove</button>}</div>)}
    </section>
    <section className="glass panel row between">
      {isHost ? <><div><b>Delete room</b><p className="muted small">Removes the room, its queue and members for everyone.</p></div><button className="btn danger" onClick={del}><Trash2 size={15}/> Delete</button></>
        : <><div><b>Leave room</b><p className="muted small">You can rejoin later with the code.</p></div><button className="btn danger" onClick={leave}><LogOut size={15}/> Leave</button></>}
    </section>
  </div>;
}
