import React, { useEffect, useRef, useState } from 'react';
import HeartCanvas, { burstHearts } from './HeartCanvas';
import IntroFX from './IntroFX';

const LINES = ['Made with love', 'for you & your people', 'Welcome to Laddu’s World'];

function BigHeart() {
  return <svg className="big-heart" viewBox="0 0 100 92" aria-hidden="true">
    <defs>
      <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff7aa8"/><stop offset=".55" stopColor="#ff3d7f"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient>
      <filter id="hglow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <path filter="url(#hglow)" fill="url(#hg)" d="M50 88C20 64 4 48 4 28 4 14 15 4 29 4c8 0 16 4 21 11C55 8 63 4 71 4c14 0 25 10 25 24 0 20-16 36-46 60z"/>
    <path fill="rgba(255,255,255,.28)" d="M24 16c-8 2-13 9-12 17 1-7 6-12 14-13 5-1 8 1 10 3-2-5-7-8-12-7z"/>
  </svg>;
}

export default function Intro({ onDone }) {
  const [stage, setStage] = useState('idle'); // idle -> bloom -> fade
  const [line, setLine] = useState(-1);
  const timers = useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const enter = () => {
    if (stage !== 'idle') { setStage('fade'); later(onDone, 600); return; }
    setStage('bloom');
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    burstHearts({ x: cx, y: cy, n: 90 });
    later(() => { setLine(0); burstHearts({ x: cx, y: cy, n: 40 }); }, 500);
    later(() => setLine(1), 1500);
    later(() => { setLine(2); burstHearts({ x: cx, y: cy, n: 70 }); }, 2500);
    later(() => setStage('fade'), 4300);
    later(onDone, 5000);
  };

  return <div className={`intro intro-${stage}`} onKeyDown={e => e.key === 'Enter' && enter()}>
    <div className="intro-aurora" aria-hidden="true"/>
    <IntroFX stage={stage} />
    <div className="intro-grid" aria-hidden="true" />
    {stage === 'bloom' && <><span className="shock s1" aria-hidden="true"/><span className="shock s2" aria-hidden="true"/></>}
    <HeartCanvas density={stage === 'idle' ? 0.5 : 1.2} intense={stage === 'bloom'} />
    <div className="intro-center">
      <div className="heart-wrap">
        <span className="ring r1"/><span className="ring r2"/><span className="ring r3"/>
        <BigHeart/>
      </div>
      {stage === 'idle' ? <>
        <h1 className="intro-title" aria-label="Laddu’s World">{[...'Laddu’s'].map((ch, k) => <span className="ltr" key={k} style={{ animationDelay: `${0.15 + k * 0.07}s` }}>{ch}</span>)}<span className="ltr sp"> </span><em>{[...'World'].map((ch, k) => <span className="ltr" key={k} style={{ animationDelay: `${0.7 + k * 0.08}s` }}>{ch}</span>)}</em></h1>
        <p className="intro-sub">A little place for watching, listening, playing and being together.</p>
        <button className="enter-btn" autoFocus onClick={enter}><span>Enter with love</span><i aria-hidden="true">♥</i></button>
      </> : <div className="intro-lines" aria-live="polite">
        {LINES.map((t, i) => <p key={t} className={`intro-line ${i === line ? 'show' : ''} ${i < line ? 'gone' : ''} ${i === 2 ? 'big' : ''}`}>{t}</p>)}
      </div>}
    </div>
    {stage === 'bloom' && <button className="intro-skip" onClick={enter}>Skip</button>}
  </div>;
}
