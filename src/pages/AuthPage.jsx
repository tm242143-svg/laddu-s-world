import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '../supabase';
import { burstHearts } from '../components/HeartCanvas';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const [avail, setAvail] = useState('idle'); // idle | checking | ok | taken | invalid | unknown
  const uname = name.trim();
  useEffect(() => {
    if (mode !== 'register') return;
    if (!uname) { setAvail('idle'); return; }
    if (!/^[A-Za-z0-9_.]{3,24}$/.test(uname)) { setAvail('invalid'); return; }
    setAvail('checking');
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { p_name: uname });
      setAvail(error ? 'unknown' : data ? 'ok' : 'taken');
    }, 350);
    return () => clearTimeout(t);
  }, [uname, mode]);

  const submit = async e => {
    e.preventDefault(); setMsg('');
    if (mode === 'register' && (avail === 'taken' || avail === 'invalid' || !uname)) { setMsg(avail === 'taken' ? 'That username is already taken — pick another one.' : 'Username must be 3–24 characters: letters, numbers, _ or .'); return; }
    setBusy(true);
    const res = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: uname } } });
    setBusy(false);
    if (res.error) { setMsg(/USERNAME_TAKEN|Database error saving new user|profiles_display_name_unique/i.test(res.error.message) ? 'That username was just taken — pick another one.' : res.error.message); return; }
    if (mode === 'register' && !res.data.session) setMsg('Check your email to confirm your account, then log in.');
    else burstHearts({ n: 60 });
  };

  return <div className="center-screen"><div className="glass auth-card">
    <div className="auth-heart"><Heart size={34} fill="currentColor"/></div>
    <h1>{mode === 'login' ? 'Welcome back' : 'Join Laddu’s World'}</h1>
    <p className="muted">{mode === 'login' ? 'Your people are waiting.' : 'Make a room. Bring your favourite people.'}</p>
    <form onSubmit={submit} className="stack">
      {mode === 'register' && <div className="stack tight"><input value={name} onChange={e => setName(e.target.value)} placeholder="Choose a unique username" maxLength={24} required autoComplete="username"/>
        {avail !== 'idle' && <small className={`uname-hint ${avail}`}>{{ checking: 'Checking…', ok: '✓ Username is available', taken: '✗ Already taken — try another', invalid: '3–24 characters: letters, numbers, _ or .', unknown: 'Could not verify right now' }[avail]}</small>}</div>}
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required autoComplete="email"/>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 6 characters)" minLength={6} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/>
      {msg && <div className="form-msg">{msg}</div>}
      <button className="btn primary lg" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
    </form>
    <button className="link-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg(''); }}>
      {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
    </button>
  </div></div>;
}
