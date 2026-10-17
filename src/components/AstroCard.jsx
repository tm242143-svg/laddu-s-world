import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { RASIS, NAKSHATRAS, dailyReading, getProfile, getSign, markSeen, personalDaily, profileReady, seenToday, setSign } from '../lib/astro';
import { navigate } from '../lib/router';

const Meter = ({ label, v }) => <div className="astro-meter"><span>{label}</span><div>{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= v ? 'on' : ''} />)}</div></div>;

// Shows once per calendar day (after the intro). Pick your rasi the first time; it is remembered on this device.
export default function AstroCard() {
  const [open, setOpen] = useState(() => !seenToday());
  const [sign, setS] = useState(getSign());
  const [flipped, setFlipped] = useState(false);
  const info = useMemo(() => RASIS.find(r => r[0] === sign), [sign]);
  const prof = useMemo(() => getProfile(), []);
  const reading = useMemo(() => (sign ? (profileReady(prof) && prof.rasi === sign ? personalDaily(prof) : dailyReading(sign)) : null), [sign, prof]);
  useEffect(() => { if (sign && open) { const t = setTimeout(() => setFlipped(true), 650); return () => clearTimeout(t); } setFlipped(false); }, [sign, open]);
  if (!open) return null;
  const close = () => { markSeen(); setOpen(false); };
  const pick = id => { setSign(id); setS(id); };
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return <div className="astro-backdrop" role="dialog" aria-modal="true" aria-label="Today's astrology card" onClick={close}>
    <div className="astro-stars" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 9) * 0.35}s` }} />)}</div>
    <div className={`astro-card ${flipped ? 'flipped' : ''}`} onClick={e => e.stopPropagation()}>
      <button className="astro-x" onClick={close} aria-label="Close"><X size={18}/></button>
      {!sign ? <div className="astro-pick">
        <span className="eyebrow">Today’s card · {day}</span>
        <h2>Choose your rasi</h2>
        <p className="muted small">One card, once a day. Pick your sign (you can change it later from the card).</p>
        <div className="astro-grid">{RASIS.map(([id, ta, en, glyph]) => <button key={id} onClick={() => pick(id)}><span>{glyph}</span><b>{ta}</b><small>{en}</small></button>)}</div>
      </div> : <div className="astro-flip">
        <div className="astro-face astro-back"><div className="astro-sigil">{info[3]}</div><b>{info[1]}</b><small>Revealing your day…</small></div>
        <div className="astro-face astro-front">
          <span className="eyebrow">{day}</span>
          <div className="astro-head"><span className="astro-glyph">{info[3]}</span><div><h2>{info[1]}</h2><small className="muted">{profileReady(prof) && prof.rasi === sign ? `${prof.name.split(' ')[0]} · ${NAKSHATRAS[prof.nak]}` : info[2]}</small></div></div>
          <p className="astro-msg">“{reading.message}”</p>
          <div className="astro-meters"><Meter label="Love" v={reading.love}/><Meter label="Career" v={reading.career}/><Meter label="Luck" v={reading.luck}/></div>
          <div className="astro-facts">
            <div><small>Lucky number</small><b>{reading.luckyNumber}</b></div>
            <div><small>Lucky colour</small><b><i className="dot" style={{ background: reading.colorHex }}/>{reading.colorName}</b></div>
            <div><small>Best time</small><b>{reading.luckyTime}</b></div>
          </div>
          <p className="astro-tip">✨ Today: {reading.tip}</p>
          <div className="row between"><button className="link-btn" onClick={() => { markSeen(); setOpen(false); navigate('/astro'); }}>My full jothidam →</button><button className="btn primary" onClick={close}>Thank you ♥</button></div>
          <small className="muted astro-note">For fun & good vibes only — not real predictions.</small>
        </div>
      </div>}
    </div>
  </div>;
}
