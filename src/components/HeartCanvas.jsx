import React, { useEffect, useRef } from 'react';

// Full-screen canvas: soft floating hearts + sparkles. Listens for "lw-burst" / "lw-react" events to spawn bursts.
const COLORS = ['#ff4d8d', '#ff7aa8', '#c084fc', '#8b5cf6', '#ffb86b', '#ff9ec4'];

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y - s * 0.3, x - s, y - s * 0.3, x - s, y + s * 0.3);
  ctx.bezierCurveTo(x - s, y + s * 0.8, x, y + s * 1.1, x, y + s * 1.5);
  ctx.bezierCurveTo(x, y + s * 1.1, x + s, y + s * 0.8, x + s, y + s * 0.3);
  ctx.bezierCurveTo(x + s, y - s * 0.3, x, y - s * 0.3, x, y + s * 0.3);
  ctx.closePath();
}

export default function HeartCanvas({ density = 1, intense = false, className = '' }) {
  const ref = useRef(null);
  const intenseRef = useRef(intense);
  intenseRef.current = intense;

  useEffect(() => {
    const canvas = ref.current; const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0, last = performance.now();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const parts = [];
    const resize = () => { w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); window.addEventListener('resize', resize);

    const spawn = (x, y, opts = {}) => parts.push({
      x, y, vx: opts.vx ?? (Math.random() - 0.5) * 18, vy: opts.vy ?? -(18 + Math.random() * 34),
      s: opts.s ?? 4 + Math.random() * 9, life: 0, max: opts.max ?? 9 + Math.random() * 8, rot: (Math.random() - 0.5) * 0.8,
      c: COLORS[(Math.random() * COLORS.length) | 0], sway: Math.random() * Math.PI * 2, kind: opts.kind || 'heart',
    });
    const burst = (x, y, n = 36) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 280; spawn(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, s: 5 + Math.random() * 13, max: 2.6 + Math.random() * 2.4, kind: Math.random() < 0.25 ? 'spark' : 'heart' }); } };
    const onBurst = e => burst(e.detail?.x ?? w / 2, e.detail?.y ?? h / 2, e.detail?.n ?? 36);
    const onReact = () => burst(w * (0.25 + Math.random() * 0.5), h * 0.85, 14);
    window.addEventListener('lw-burst', onBurst); window.addEventListener('lw-react', onReact);

    let acc = 0;
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, w, h);
      acc += dt * (reduce ? 0.8 : 3.2) * density * (intenseRef.current ? 3 : 1);
      while (acc > 1) { acc -= 1; spawn(Math.random() * w, h + 20, { vx: (Math.random() - 0.5) * 8, vy: -(22 + Math.random() * 40), max: 11 + Math.random() * 9 }); }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life += dt;
        if (p.life > p.max || p.y < -40 || p.y > h + 60) { parts.splice(i, 1); continue; }
        p.sway += dt * 1.6; p.x += (p.vx + Math.sin(p.sway) * 9) * dt; p.y += p.vy * dt; p.vx *= 0.995; p.vy += (p.kind === 'spark' ? 60 : 8) * dt;
        const t = p.life / p.max, alpha = t < 0.1 ? t * 10 : t > 0.7 ? Math.max(0, (1 - t) / 0.3) : 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(p.sway) * 0.2); ctx.globalAlpha = alpha * 0.85;
        ctx.shadowColor = p.c; ctx.shadowBlur = 14; ctx.fillStyle = p.c;
        if (p.kind === 'spark') { ctx.beginPath(); ctx.arc(0, 0, p.s * 0.28, 0, 7); ctx.fill(); } else { heart(ctx, 0, -p.s * 0.6, p.s); ctx.fill(); }
        ctx.restore();
      }
      if (parts.length > 700) parts.splice(0, parts.length - 700);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('lw-burst', onBurst); window.removeEventListener('lw-react', onReact); };
  }, [density]);

  return <canvas ref={ref} className={`heart-canvas ${className}`} aria-hidden="true" />;
}

export const burstHearts = (detail = {}) => window.dispatchEvent(new CustomEvent('lw-burst', { detail }));
