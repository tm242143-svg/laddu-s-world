import React, { useEffect, useRef } from 'react';

// Intro graphics: a swirling galaxy of glowing particles. On "bloom" they are pulled into a heart, pulse, then explode outward.
const COLORS = ['#ff4d8d', '#ff7aa8', '#c084fc', '#8b5cf6', '#ffb86b', '#ffffff'];
const heartPt = t => ({ x: 16 * Math.sin(t) ** 3, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) });

export default function IntroFX({ stage }) {
  const ref = useRef(null); const stageRef = useRef(stage); const t0 = useRef(0);
  if (stageRef.current !== stage) { stageRef.current = stage; t0.current = performance.now(); }
  useEffect(() => {
    const c = ref.current; const ctx = c.getContext('2d'); const dpr = Math.min(2, window.devicePixelRatio || 1);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0;
    const resize = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); window.addEventListener('resize', resize);
    const N = Math.min(1100, Math.max(450, Math.floor((window.innerWidth * window.innerHeight) / 1800)));
    const P = Array.from({ length: N }, (_, i) => {
      const a = Math.random() * Math.PI * 2, r = 40 + Math.pow(Math.random(), 0.6) * Math.max(window.innerWidth, window.innerHeight) * 0.6;
      const hp = heartPt((i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.06); const fill = Math.random() < 0.55 ? 1 : Math.sqrt(Math.random());
      return { a, r, sp: (0.05 + Math.random() * 0.25) * (Math.random() < 0.5 ? 1 : -1), x: 0, y: 0, vx: 0, vy: 0, hx: hp.x * fill, hy: hp.y * fill, s: 0.6 + Math.random() * 1.8, col: COLORS[Math.floor(Math.random() * COLORS.length)], ph: Math.random() * 6 };
    });
    let last = performance.now();
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const st = stageRef.current; const el = (now - t0.current) / 1000; const cx = w / 2, cy = h / 2; const sc = Math.min(w, h) / 40;
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(13,7,20,.22)'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const beat = 1 + Math.sin(el * 7) * 0.035 * Math.min(1, el);
      for (const p of P) {
        let tx, ty, k;
        if (st === 'idle') { p.a += p.sp * dt * (reduce ? 0.2 : 1); const sq = 0.55; tx = cx + Math.cos(p.a) * p.r; ty = cy + Math.sin(p.a) * p.r * sq; k = 4; }
        else if (st === 'bloom' && el < 2.1) { tx = cx + p.hx * sc * (st === 'bloom' ? beat : 1) * 1.15; ty = cy + p.hy * sc * beat * 1.15 - sc * 1.2; k = 6 + Math.min(el, 1.5) * 6; }
        else if (st === 'bloom') { if (!p.boom) { const ang = Math.atan2(p.y - cy, p.x - cx) + (Math.random() - 0.5) * 0.5; const f = 250 + Math.random() * 650; p.vx = Math.cos(ang) * f; p.vy = Math.sin(ang) * f; p.boom = true; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985; tx = null; }
        else { p.x += (p.x - cx) * dt * 1.2; p.y += (p.y - cy) * dt * 1.2; tx = null; }
        if (tx !== null) { if (p.x === 0 && p.y === 0) { p.x = tx + (Math.random() - 0.5) * 80; p.y = ty + (Math.random() - 0.5) * 80; } p.boom = false; p.x += (tx - p.x) * Math.min(1, k * dt); p.y += (ty - p.y) * Math.min(1, k * dt); }
        const tw = 0.55 + 0.45 * Math.sin(now / 260 + p.ph);
        ctx.globalAlpha = (st === 'fade' ? 0.5 : 0.9) * tw; ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (st === 'bloom' && el < 2.1 ? 1.15 : 1), 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1; raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="intro-fx" aria-hidden="true" />;
}
