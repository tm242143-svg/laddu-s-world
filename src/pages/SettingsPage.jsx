import React, { useState } from 'react';
import { Eye, Lock, Mic, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { supabase } from '../supabase';
import { useApp } from '../context/AppContext';
import { usePrivacy, wipeLocalData } from '../lib/privacy';
import { cryptoOk } from '../lib/crypto';

const EMOJIS = ['🦋', '🌸', '🦊', '🐼', '🌙', '⭐', '🍓', '🎧', '🔥', '🐯'];
function Toggle({ on, onChange, icon: Icon, title, desc }) {
  return <label className="toggle-row"><span className="tile-icon sm"><Icon size={17}/></span><span className="grow"><b>{title}</b><small className="muted">{desc}</small></span><input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} /><i className="switch" /></label>;
}
export default function SettingsPage() {
  const { profile, displayName, updateProfile, toast, signOut } = useApp();
  const [p, set] = usePrivacy(); const [name, setName] = useState(displayName);
  const cur = String(profile?.avatar_url || '').startsWith('emoji:') ? profile.avatar_url.slice(6) : '';
  return <div className="page narrow stack gap">
    <section className="glass panel stack settings-hero"><span className="eyebrow"><ShieldCheck size={13}/> Privacy & settings</span><h1>You’re in control.</h1>
      <p className="muted">Chat is never saved, calls are peer-to-peer, and these choices stay on this device only.</p></section>
    <section className="glass panel stack"><h3><UserRound size={18}/> Profile</h3>
      <form className="url-form" onSubmit={async e => { e.preventDefault(); const n = name.trim().slice(0, 24); if (!/^[A-Za-z0-9_.]{3,24}$/.test(n)) { toast('Username: 3–24 characters, letters, numbers, _ or .', 'warn'); return; } if (n !== displayName) { const { data } = await supabase.rpc('username_available', { p_name: n }); if (data === false) { toast('That username is already taken — pick another one.', 'warn'); return; } } if (n && await updateProfile({ display_name: n })) toast('Profile saved ♥', 'love'); }}>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={24} aria-label="Username" /><button className="btn primary">Save name</button></form>
      <div className="emoji-row">{EMOJIS.map(e => <button key={e} className={`emoji-btn ${cur === e ? 'sel' : ''}`} onClick={() => updateProfile({ avatar_url: `emoji:${e}` })}>{e}</button>)}</div></section>
    <section className="glass panel stack"><h3><Lock size={18}/> Privacy</h3>
      <Toggle icon={Eye} on={p.anonymousPresence} onChange={v => set({ anonymousPresence: v })} title="Appear as “Guest” in rooms" desc="Hides your name in the people list, chat and reactions." />
      <Toggle icon={Eye} on={p.hideTyping} onChange={v => set({ hideTyping: v })} title="Hide my typing indicator" desc="Others won’t see when you’re typing." />
      <Toggle icon={Mic} on={p.muteOnJoin} onChange={v => set({ muteOnJoin: v })} title="Join calls muted" desc="Your microphone starts off." />
      <Toggle icon={Mic} on={p.camOffOnJoin} onChange={v => set({ camOffOnJoin: v })} title="Join video calls with camera off" desc="Turn it on whenever you’re ready." />
</section>
    <section className="glass panel stack"><h3><Lock size={18}/> Messages</h3>
      <p className="muted">Chat is <b>never saved</b> in any database. Messages travel live between people in the room, are end-to-end encrypted, and are <b>deleted the moment you leave the room</b> — from your screen and from everyone else’s.</p>
      <label className="ast-form"><span>Also auto-delete messages after</span><select value={p.chatTtl || 0} onChange={e => set({ chatTtl: Number(e.target.value) })}><option value={0}>Only when I leave the room</option><option value={1}>1 minute</option><option value={5}>5 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option></select></label>
      <Toggle icon={Mic} on={p.sounds} onChange={v => set({ sounds: v })} title="Message sound" desc="A soft ping for new messages." /></section>
    <section className="glass panel stack"><h3>Data</h3><div className="row">
      <button className="btn ghost" onClick={() => { wipeLocalData(); toast('Local data cleared', 'love'); }}><Trash2 size={15}/> Clear local data</button><button className="btn ghost" onClick={signOut}>Log out</button></div>
      <p className="muted small">Honest note: room members and the site owner can see the room code, so encrypted chat protects against network and server eavesdropping, not against someone you invited.</p></section>
  </div>;
}
