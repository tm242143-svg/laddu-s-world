import React, { useEffect, useRef, useState } from 'react';
import { Check, Clock, Lock, Send, Smile, Unlock } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { useApp } from '../../context/AppContext';
import { initial } from '../../lib/util';
import { cryptoOk } from '../../lib/crypto';

const QUICK = ['❤️', '😂', '🥹', '🔥', '👍', '😘', '🎉', '😭'];

export default function ChatPage() {
  const { messages, sendChat, setChatOpen, conn, typing, sendTyping, passphrase, setPassphrase, priv, clearChat } = useRoom();
  const { uid } = useApp();
  const [text, setText] = useState(''); const [pp, setPp] = useState(false); const [emo, setEmo] = useState(false); const end = useRef(null);
  useEffect(() => { setChatOpen(true); return () => setChatOpen(false); }, [setChatOpen]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, typing]);
  const secure = priv.encryptChat && cryptoOk();
  const who = Object.values(typing);
  const submit = e => { e.preventDefault(); if (!text.trim()) return; sendChat(text); setText(''); setEmo(false); };
  return <section className="glass panel chat">
    <div className="chat-top">
      <span className={`chip ${conn === 'live' ? 'ok' : 'warn'}`}>{conn === 'live' ? '● Live' : conn === 'offline' ? '● Reconnecting…' : '● Connecting…'}</span>
      <span className="chip" title={secure ? 'Messages are AES-256 encrypted in your browser' : 'Encryption is off or unavailable (needs https)'}>{secure ? <><Lock size={12}/> Encrypted · vanishes on exit</> : <><Unlock size={12}/> Vanishes on exit</>}</span>
      <button className="link-btn" onClick={() => setPp(p => !p)}>{passphrase ? 'Passphrase set' : 'Add passphrase'}</button>
      <button className="link-btn" onClick={clearChat}>Clear screen</button>
    </div>
    {pp && <div className="pp-row"><input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="Shared secret — everyone must enter the same one" maxLength={64} autoComplete="off" /><small className="muted">Only people who know it can read new messages.</small></div>}
    <div className="chat-log">
      {messages.length === 0 && <p className="muted center-text">Say something nice ♥ Messages are never stored — they disappear when you leave.</p>}
      {messages.map(m => <div key={m.id} className={`msg ${m.user_id === uid ? 'mine' : ''}`}><span className="avatar sm">{initial(m.name)}</span><div className="bubble"><small>{m.name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{m.user_id === uid && <span className="tick">{m.status === 'sent' ? <Check size={11}/> : <Clock size={11}/>}</span>}</small><p>{m.body}</p></div></div>)}
      {who.length > 0 && !priv.hideTyping && <div className="typing"><span className="dots"><i/><i/><i/></span> {who.join(', ')} {who.length > 1 ? 'are' : 'is'} typing</div>}
      <div ref={end} />
    </div>
    {emo && <div className="emoji-row quick">{QUICK.map(e => <button key={e} type="button" className="emoji-btn" onClick={() => setText(t => t + e)}>{e}</button>)}</div>}
    <form className="chat-compose" onSubmit={submit}>
      <button type="button" className="icon-btn" onClick={() => setEmo(v => !v)} aria-label="Emoji"><Smile size={18}/></button>
      <input value={text} onChange={e => { setText(e.target.value); sendTyping(); }} placeholder="Message the room…" maxLength={1000} enterKeyHint="send" autoComplete="off" />
      <button className="btn primary" disabled={!text.trim()} aria-label="Send"><Send size={16}/></button>
    </form>
  </section>;
}
