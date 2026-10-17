import React, { useCallback, useEffect, useState } from 'react';
import { Search, UserPlus, UserCheck, Clock, X, DoorOpen, Heart } from 'lucide-react';
import { supabase } from '../supabase';
import { useApp } from '../context/AppContext';
import { initial } from '../lib/util';

export default function FriendsPage() {
  const { uid, rooms, requests, loadNotifs, toast } = useApp();
  const [tab, setTab] = useState('find');
  const [q, setQ] = useState(''); const [results, setResults] = useState([]); const [searching, setSearching] = useState(false);
  const [links, setLinks] = useState([]);   // all friendship rows involving me
  const [names, setNames] = useState({});
  const [inviteRoom, setInviteRoom] = useState('');

  const loadLinks = useCallback(async () => {
    const { data } = await supabase.from('friendships').select('requester_id,addressee_id,status').or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
    setLinks(data || []);
    const ids = [...new Set((data || []).flatMap(l => [l.requester_id, l.addressee_id]).filter(i => i !== uid))];
    if (ids.length) { const p = await supabase.from('profiles').select('id,display_name').in('id', ids); setNames(Object.fromEntries((p.data || []).map(x => [x.id, x.display_name]))); }
  }, [uid]);
  useEffect(() => { loadLinks(); }, [loadLinks, requests.length]);
  useEffect(() => { if (!inviteRoom && rooms[0]) setInviteRoom(rooms[0].id); }, [rooms, inviteRoom]);

  // Debounced search by display name.
  useEffect(() => {
    const term = q.trim().replace(/[%,]/g, '');
    if (term.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id,display_name').ilike('display_name', `%${term}%`).neq('id', uid).limit(12);
      setResults(data || []); setSearching(false);
    }, 280);
    return () => clearTimeout(t);
  }, [q, uid]);

  const relation = id => {
    const l = links.find(x => x.requester_id === id || x.addressee_id === id);
    if (!l) return 'none';
    if (l.status === 'accepted') return 'friends';
    if (l.status === 'blocked') return 'blocked';
    return l.requester_id === uid ? 'sent' : 'received';
  };
  const request = async id => {
    const { error } = await supabase.from('friendships').insert({ requester_id: uid, addressee_id: id, status: 'pending' });
    if (error) toast(error.code === '23505' ? 'Request already exists.' : error.message, 'warn'); else toast('Friend request sent 💌', 'love');
    loadLinks();
  };
  const accept = async id => { await supabase.from('friendships').update({ status: 'accepted' }).eq('requester_id', id).eq('addressee_id', uid); toast('You are friends now 💞', 'love'); loadLinks(); loadNotifs(); };
  const remove = async id => { await supabase.from('friendships').delete().or(`and(requester_id.eq.${uid},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${uid})`); loadLinks(); loadNotifs(); };
  const invite = async id => {
    if (!inviteRoom) { toast('Create a room first.', 'warn'); return; }
    const { error } = await supabase.from('room_invites').insert({ room_id: inviteRoom, from_id: uid, to_id: id });
    if (error) toast(error.code === '23505' ? 'Already invited to that room.' : error.message, 'warn'); else toast('Invite sent 🎟️', 'love');
  };

  const friends = links.filter(l => l.status === 'accepted').map(l => l.requester_id === uid ? l.addressee_id : l.requester_id);
  const sent = links.filter(l => l.status === 'pending' && l.requester_id === uid).map(l => l.addressee_id);

  const Action = ({ id }) => {
    const r = relation(id);
    if (r === 'friends') return <span className="chip ok"><UserCheck size={14}/> Friends</span>;
    if (r === 'sent') return <span className="chip"><Clock size={14}/> Requested</span>;
    if (r === 'received') return <button className="btn primary sm" onClick={() => accept(id)}>Accept</button>;
    if (r === 'blocked') return null;
    return <button className="btn primary sm" onClick={() => request(id)}><UserPlus size={14}/> Add friend</button>;
  };

  return <div className="page narrow">
    <div className="section-head"><div><span className="eyebrow">People you love</span><h1>Friends</h1></div></div>
    <div className="seg wide">
      <button className={tab === 'find' ? 'on' : ''} onClick={() => setTab('find')}>Find people</button>
      <button className={tab === 'requests' ? 'on' : ''} onClick={() => setTab('requests')}>Requests{requests.length > 0 && <span className="pill">{requests.length}</span>}</button>
      <button className={tab === 'friends' ? 'on' : ''} onClick={() => setTab('friends')}>My friends ({friends.length})</button>
    </div>

    {tab === 'find' && <div className="glass panel stack">
      <label className="search"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name…" autoFocus/></label>
      {q.trim().length >= 2 && !searching && results.length === 0 && <p className="muted">No one found for “{q}”.</p>}
      {results.map(p => <div className="person" key={p.id}><span className="avatar">{initial(p.display_name)}</span><b>{p.display_name}</b><Action id={p.id}/></div>)}
      {sent.length > 0 && <><h4 className="muted">Waiting for a reply</h4>{sent.map(id => <div className="person" key={id}><span className="avatar">{initial(names[id])}</span><b>{names[id] || '…'}</b><button className="btn ghost sm" onClick={() => remove(id)}>Cancel</button></div>)}</>}
    </div>}

    {tab === 'requests' && <div className="glass panel stack">
      {requests.length === 0 && <p className="muted">No pending requests.</p>}
      {requests.map(r => <div className="person" key={r.requester_id}><span className="avatar">{initial(r.name)}</span><b>{r.name}</b>
        <button className="btn primary sm" onClick={() => accept(r.requester_id)}>Accept</button><button className="icon-btn" onClick={() => remove(r.requester_id)} aria-label="Decline"><X size={16}/></button></div>)}
    </div>}

    {tab === 'friends' && <div className="glass panel stack">
      {friends.length > 0 && <label className="inline-field"><DoorOpen size={16}/> Invite to <select value={inviteRoom} onChange={e => setInviteRoom(e.target.value)}>{rooms.length === 0 && <option value="">No rooms</option>}{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
      {friends.length === 0 && <p className="muted"><Heart size={14}/> No friends yet — search for someone to get started.</p>}
      {friends.map(id => <div className="person" key={id}><span className="avatar">{initial(names[id])}</span><b>{names[id] || '…'}</b>
        <button className="btn ghost sm" onClick={() => invite(id)}>Invite</button><button className="icon-btn" onClick={() => window.confirm('Remove this friend?') && remove(id)} aria-label="Remove friend"><X size={16}/></button></div>)}
    </div>}
  </div>;
}
