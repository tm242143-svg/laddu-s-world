import React, { useState } from 'react';
import { ArrowRight, Copy, Lock, Globe, Plus, Trash2, Users } from 'lucide-react';
import { supabase } from '../supabase';
import { useApp } from '../context/AppContext';
import { navigate } from '../lib/router';
import { makeCode } from '../lib/util';
import { burstHearts } from '../components/HeartCanvas';

export default function RoomsPage() {
  const { uid, rooms, loadRooms, toast } = useApp();
  const [name, setName] = useState(''); const [visibility, setVisibility] = useState('private');
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false);

  const create = async e => {
    e.preventDefault(); setBusy(true);
    const { data, error } = await supabase.rpc('create_room', { p_name: name.trim() || 'Our room', p_code: makeCode(), p_visibility: visibility });
    setBusy(false);
    if (error || !data?.[0]) { toast(error?.message || 'Could not create the room', 'warn'); return; }
    burstHearts({ n: 70 }); setName(''); await loadRooms(); navigate(`/room/${data[0].id}/watch`);
  };
  const join = async e => {
    e.preventDefault(); setBusy(true);
    const { data, error } = await supabase.rpc('join_room_by_code', { p_code: code });
    setBusy(false);
    if (error) { toast(error.message, 'warn'); return; }
    if (!data?.[0]) { toast('No room with that code.', 'warn'); return; }
    setCode(''); await loadRooms(); navigate(`/room/${data[0].id}/watch`);
  };
  const remove = async r => {
    if (!window.confirm(`Delete “${r.name}” for everyone? This cannot be undone.`)) return;
    const { error } = await supabase.from('rooms').delete().eq('id', r.id);
    if (error) toast(error.message, 'warn'); else { toast('Room deleted'); loadRooms(); }
  };
  const copy = r => navigator.clipboard?.writeText(r.code).then(() => toast(`Code ${r.code} copied`, 'love'), () => toast(`Code: ${r.code}`));

  return <div className="page">
    <div className="section-head"><div><span className="eyebrow">Your hangouts</span><h1>Rooms</h1></div></div>
    <div className="grid2">
      <form className="glass panel stack" onSubmit={create}>
        <h3><Plus size={18}/> Create a room</h3>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Room name (e.g. Friday Night)" maxLength={60}/>
        <div className="seg"><button type="button" className={visibility === 'private' ? 'on' : ''} onClick={() => setVisibility('private')}><Lock size={14}/> Private</button><button type="button" className={visibility === 'public' ? 'on' : ''} onClick={() => setVisibility('public')}><Globe size={14}/> Public</button></div>
        <button className="btn primary" disabled={busy}>Create room <ArrowRight size={16}/></button>
      </form>
      <form className="glass panel stack" onSubmit={join}>
        <h3><Users size={18}/> Join with a code</h3>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ENTER ROOM CODE" maxLength={12}/>
        <button className="btn ghost" disabled={busy || !code.trim()}>Join room <ArrowRight size={16}/></button>
      </form>
    </div>

    <div className="section-head"><h2>My rooms ({rooms.length})</h2></div>
    {rooms.length === 0 ? <div className="glass empty"><p>You are not in any room yet.</p></div> :
      <div className="grid3">{rooms.map((r, i) => <article className={`glass room-card art-${i % 4}`} key={r.id}>
        <span className="room-code">{r.code}</span>
        <h3>{r.name}</h3>
        <span className="muted">{r.visibility === 'private' ? <Lock size={12}/> : <Globe size={12}/>} {r.visibility}{r.member_count ? ` · ${r.member_count} member${r.member_count > 1 ? 's' : ''}` : ''}{r.host_id === uid ? ' · you host' : ''}</span>
        <div className="row tight">
          <button className="btn primary sm" onClick={() => navigate(`/room/${r.id}/watch`)}>Enter <ArrowRight size={14}/></button>
          <button className="btn ghost sm" onClick={() => copy(r)}><Copy size={14}/> Code</button>
          {r.host_id === uid && <button className="btn ghost sm" onClick={() => navigate(`/room/${r.id}/manage`)}>Manage</button>}
          {r.host_id === uid && <button className="icon-btn danger" onClick={() => remove(r)} aria-label="Delete room"><Trash2 size={15}/></button>}
        </div>
      </article>)}</div>}
  </div>;
}
