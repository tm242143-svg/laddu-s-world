import React, { useMemo, useState } from 'react';
import { Heart, Sparkles, Star, Wand2 } from 'lucide-react';
import { NAKSHATRAS, RASIS, coupleReading, emptyProfile, futureReading, getProfile, moonSign, personalDaily, profileReady, saveProfile } from '../lib/astro';

const Stars = ({ n }) => <span className="ast-stars" aria-label={`${n} of 5`}>{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= n ? 'on' : ''}>★</i>)}</span>;

function PersonForm({ value, onChange, title, onDone, doneLabel }) {
  const [v, setV] = useState({ ...emptyProfile, ...value });
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const detect = () => { const r = moonSign(v.dob, v.tob || '12:00'); if (r) setV(o => ({ ...o, rasi: r.rasi, nak: r.nakshatra })); };
  const ok = v.name.trim() && v.rasi && v.nak >= 0;
  return <div className="ast-form">
    <h3>{title}</h3>
    <label>Name<input value={v.name} onChange={e => set('name', e.target.value)} placeholder="Full name" maxLength={40} /></label>
    <div className="ast-two"><label>Date of birth<input type="date" value={v.dob} onChange={e => set('dob', e.target.value)} max={new Date().toISOString().slice(0, 10)} /></label>
      <label>Birth time (optional)<input type="time" value={v.tob} onChange={e => set('tob', e.target.value)} /></label></div>
    <button type="button" className="btn ghost sm" onClick={detect} disabled={!v.dob}><Wand2 size={14}/> Auto-find rasi & natchathiram from DOB</button>
    <small className="muted">Auto-find is an approximation (IST assumed; add birth time for a closer result). If you know them from your horoscope, pick below.</small>
    <div className="ast-two"><label>Rasi<select value={v.rasi} onChange={e => set('rasi', e.target.value)}><option value="">Choose…</option>{RASIS.map(r => <option key={r[0]} value={r[0]}>{r[3]} {r[1]} ({r[2]})</option>)}</select></label>
      <label>Natchathiram<select value={v.nak} onChange={e => set('nak', Number(e.target.value))}><option value={-1}>Choose…</option>{NAKSHATRAS.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></label></div>
    <button className="btn primary" disabled={!ok} onClick={() => { const p = { ...v, name: v.name.trim() }; onChange?.(p); onDone?.(p); }}>{doneLabel}</button>
  </div>;
}

function Today({ p }) {
  const d = useMemo(() => personalDaily(p), [p]); const sign = RASIS.find(r => r[0] === p.rasi);
  return <div className="stack gap">
    <section className="ast-hero glass"><span className="ast-glyph">{sign[3]}</span><div><span className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span><h2>Hi {d.greet} — {sign[1]} · {NAKSHATRAS[p.nak]}</h2><p className="astro-msg">“{d.message}”</p></div>
      <div className="ast-score"><b>{d.dayScore}</b><small>Day score</small></div></section>
    <div className="grid3 ast-cols">
      <article className="glass tile"><h3>💼 Work</h3><p>{d.work}</p><Stars n={d.career}/></article>
      <article className="glass tile"><h3>💞 Love</h3><p>{d.loveLine}</p><Stars n={d.love}/></article>
      <article className="glass tile"><h3>🍀 Luck</h3><p>{d.money}</p><Stars n={d.luck}/></article>
    </div>
    <section className="glass panel"><div className="astro-facts"><div><small>Lucky number</small><b>{d.luckyNumber}</b></div><div><small>Lucky colour</small><b><i className="dot" style={{ background: d.colorHex }}/>{d.colorName}</b></div><div><small>Best time</small><b>{d.luckyTime}</b></div></div>
      <p className="astro-tip">🌿 {d.health}</p><p className="astro-tip">⭐ {d.starNote}</p><p className="muted small">Avoid important starts during Rahu kalam: {d.rahu}</p></section>
  </div>;
}

function Match({ me }) {
  const [partner, setPartner] = useState(() => { try { return JSON.parse(localStorage.getItem('lw-astro-partner') || 'null'); } catch { return null; } });
  const [edit, setEdit] = useState(!partner);
  const res = useMemo(() => (partner ? coupleReading(me, partner) : null), [me, partner]);
  const save = p => { setPartner(p); setEdit(false); try { localStorage.setItem('lw-astro-partner', JSON.stringify(p)); } catch { /* ignore */ } };
  if (edit || !res) return <section className="glass panel"><PersonForm value={partner || {}} title="Your partner’s details" onDone={save} doneLabel="Check our match ♥" /></section>;
  return <div className="stack gap">
    <section className="ast-hero glass"><div className="ast-pair"><span>{me.name.split(' ')[0]}</span><Heart size={22} fill="currentColor"/><span>{partner.name.split(' ')[0]}</span></div>
      <div className="ast-score big"><b>{res.score}%</b><small>{res.verdict}</small></div><p className="muted">{res.advice}</p>
      <button className="link-btn" onClick={() => setEdit(true)}>Change partner</button></section>
    <section className="glass panel stack"><div className="section-head tight"><h3>10 Porutham</h3><span className="chip ok">{res.passed}/10 matched</span></div>
      <ul className="ast-por">{res.items.map(i => <li key={i.name} className={i.ok ? 'ok' : 'no'}><b>{i.ok ? '✓' : '✗'} {i.name}</b><span>{i.meaning}</span></li>)}</ul>
      {res.critical > 0 && <p className="astro-tip">Heads-up: Rajju, Vedha or Yoni did not match — traditional astrologers weigh these most, so talk it through with elders if this matters to you.</p>}</section>
    <section className="glass panel stack"><h3>Your future together</h3>
      <p>Strongest together: <b>{res.strength}</b>. Watch out for: <b>{res.fight}</b>. Best month for big decisions: <b>{res.luckyMonth}</b>.</p>
      <div className="ast-timeline">{res.years.map(y => <div key={y.year}><b>{y.year}</b><span>{y.theme}</span><Stars n={y.mood}/></div>)}</div></section>
    <p className="muted small">Matching uses the classical 10-porutham tables in simplified form plus a name-number bond. Entertainment only — never a reason to choose or leave anyone.</p>
  </div>;
}

function Future({ p }) {
  const f = useMemo(() => futureReading(p), [p]);
  return <div className="stack gap">
    <section className="glass panel stack"><span className="eyebrow"><Sparkles size={13}/> Next 12 months</span><h2>Your road ahead, {p.name.split(' ')[0]}</h2>
      <p className="muted">You are {f.trait}. Ruling planet of your rasi: <b>{f.lord}</b>.</p>
      <div className="ast-bars">{f.months.map(m => <div key={m.full} title={`${m.full}: ${m.tag}`}><i style={{ height: `${m.score * 18}px` }} className={m.score >= 4 ? 'hi' : ''}/><small>{m.label.split(' ')[0]}</small></div>)}</div>
      <p>Best months for new plans: <b>{f.best.join(' · ')}</b></p></section>
    <div className="grid3 ast-cols">{f.areas.map(a => <article className="glass tile" key={a.id}><h3>{a.icon} {a.label}</h3><p>{a.text}</p><Stars n={a.stars}/></article>)}</div>
    <section className="glass panel stack"><h3>Next 5 years</h3><div className="ast-timeline">{f.phases.map(ph => <div key={ph.year}><b>{ph.year}{ph.age !== null ? ` · age ${ph.age}` : ''}</b><span><u>{ph.title}</u> — {ph.text}</span></div>)}</div>
      <p className="astro-tip">⚠️ {f.caution}</p><p className="astro-tip">🪔 {f.blessing}</p></section>
    <p className="muted small">For fun & reflection only — not real predictions, and not financial, medical or legal advice.</p>
  </div>;
}

export default function AstroPage() {
  const [p, setP] = useState(getProfile); const [tab, setTab] = useState('today'); const [editing, setEditing] = useState(false);
  const ready = profileReady(p);
  const done = np => { saveProfile(np); setP(np); setEditing(false); };
  return <div className="page narrow">
    <section className="hero glass"><div className="hero-copy"><span className="eyebrow"><Star size={13}/> Jothidam</span><h1>Your stars, <em>your day.</em></h1><p>Daily rasipalan, partner matching and your future outlook — from your name, rasi, natchathiram and date of birth.</p></div></section>
    {!ready || editing ? <section className="glass panel"><PersonForm value={p} title={ready ? 'Edit your details' : 'Tell us about you'} onDone={done} doneLabel="Save & see my stars ✨" />{editing && <button className="link-btn" onClick={() => setEditing(false)}>Cancel</button>}</section> : <>
      <nav className="room-tabs ast-tabs">{[['today', 'Today'], ['match', 'Partner match'], ['future', 'Future']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{l}</span></button>)}<button onClick={() => setEditing(true)}><span>Edit me</span></button></nav>
      {tab === 'today' && <Today p={p} />}{tab === 'match' && <Match me={p} />}{tab === 'future' && <Future p={p} />}
    </>}
  </div>;
}
