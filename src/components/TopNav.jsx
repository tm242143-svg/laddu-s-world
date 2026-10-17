import React, { useEffect, useRef, useState } from 'react';
import { Bell, Compass, Settings, Heart, Home, LogOut, Users, UserPlus, Check, X, DoorOpen, Star, Tv } from 'lucide-react';
import { supabase } from '../supabase';
import { useApp } from '../context/AppContext';
import { navigate, useRoute } from '../lib/router';
import { initial } from '../lib/util';

function NotifBell() {
  const { uid, requests, invites, loadNotifs, loadRooms, toast } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const count = requests.length + invites.length;
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  const respondFriend = async (r, accept) => {
    const q = supabase.from('friendships');
    const { error } = accept ? await q.update({ status: 'accepted' }).eq('requester_id', r.requester_id).eq('addressee_id', uid) : await q.delete().eq('requester_id', r.requester_id).eq('addressee_id', uid);
    if (error) toast(error.message, 'warn'); else toast(accept ? `You and ${r.name} are friends 💞` : 'Request declined', accept ? 'love' : 'info');
    loadNotifs();
  };
  const respondInvite = async (inv, accept) => {
    const { data, error } = await supabase.rpc('respond_room_invite', { p_invite_id: inv.id, p_accept: accept });
    if (error) { toast(error.message, 'warn'); return; }
    await loadNotifs(); await loadRooms();
    if (accept && data?.[0]) { setOpen(false); navigate(`/room/${data[0].id}/watch`); }
  };

  return <div className="notif-wrap" ref={ref}>
    <button className="icon-btn" onClick={() => setOpen(o => !o)} aria-label="Notifications"><Bell size={19}/>{count > 0 && <span className="badge">{count}</span>}</button>
    {open && <div className="dropdown glass notif-panel">
      <h4>Notifications</h4>
      {count === 0 && <p className="muted pad">Nothing new — enjoy the quiet ♥</p>}
      {requests.map(r => <div className="notif-row" key={r.requester_id}><span className="avatar sm">{initial(r.name)}</span><span><b>{r.name}</b> sent a friend request</span>
        <button className="mini ok" onClick={() => respondFriend(r, true)} aria-label="Accept"><Check size={15}/></button><button className="mini no" onClick={() => respondFriend(r, false)} aria-label="Decline"><X size={15}/></button></div>)}
      {invites.map(i => <div className="notif-row" key={i.id}><span className="avatar sm"><DoorOpen size={15}/></span><span><b>{i.from_name}</b> invited you to <b>{i.room_name}</b></span>
        <button className="mini ok" onClick={() => respondInvite(i, true)} aria-label="Join"><Check size={15}/></button><button className="mini no" onClick={() => respondInvite(i, false)} aria-label="Decline"><X size={15}/></button></div>)}
    </div>}
  </div>;
}

export default function TopNav() {
  const { displayName, signOut, profile } = useApp();
  const emoji = String(profile?.avatar_url || '').startsWith('emoji:') ? profile.avatar_url.slice(6) : '';
  const { parts } = useRoute();
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const active = parts[0] === 'rooms' || parts[0] === 'room' ? 'rooms' : parts[0] === 'friends' ? 'friends' : parts[0] === 'discover' ? 'discover' : parts[0] === 'astro' ? 'astro' : parts[0] === 'anime' ? 'anime' : 'home';
  const items = [['home', '/', 'Home', Home], ['rooms', '/rooms', 'Rooms', Users], ['discover', '/discover', 'Discover', Compass], ['astro', '/astro', 'Astro', Star], ['anime', '/anime', 'Anime', Tv], ['friends', '/friends', 'Friends', UserPlus]];
  return <header className="topnav glass">
    <a className="brand" href="#/"><span className="brand-heart"><Heart size={18} fill="currentColor"/></span><span>Laddu’s <b>World</b></span></a>
    <nav className="nav-pills">{items.map(([k, p, label, Icon]) => <button key={k} className={active === k ? 'on' : ''} onClick={() => navigate(p)}><Icon size={16}/><span>{label}</span></button>)}</nav>
    <div className="nav-right">
      <NotifBell />
      <div className="menu-wrap" ref={ref}>
        <button className="avatar" onClick={() => setMenu(m => !m)} aria-label="Account menu">{emoji || initial(displayName)}</button>
        {menu && <div className="dropdown glass"><div className="pad"><b>{displayName}</b></div><button className="menu-item" onClick={() => { setMenu(false); navigate('/settings'); }}><Settings size={16}/> Privacy & settings</button><button className="menu-item" onClick={signOut}><LogOut size={16}/> Log out</button></div>}
      </div>
    </div>
  </header>;
}
