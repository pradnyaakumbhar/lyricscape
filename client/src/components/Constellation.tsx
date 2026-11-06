import { useEffect, useRef } from "react";
import type { Line } from "../lib/lrc";

interface Props {
  lines: Line[];
  getPositionMs: () => number;
  hue?: number;
}

interface Layout {
  i: number;
  pts: { x: number; y: number }[];
  links: [number, number][];
}

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Constellation({ lines, getPositionMs, hue = 268 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep latest props accessible inside the RAF loop without restarting it.
  const live = useRef({ lines, getPositionMs, hue });
  live.current = { lines, getPositionMs, hue };

  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    let W = 0, H = 0, raf = 0;
    let cur = -2;
    let layout: Layout | null = null;
    let prev: Layout | null = null;
    let fade = 1;
    let lastLines: Line[] = [];

    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cur = -2; prev = null;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    resize();

    const makeLayout = (i: number, L: Line): Layout => {
      const n = L.words.length;
      const r = rng(i * 7919 + 13);
      const mx = W * 0.1, my = H * 0.16;
      const iw = W - 2 * mx, ih = H - 2 * my - H * 0.06;
      const pts = Array.from({ length: n }, (_, k) => ({
        x: mx + iw * (n === 1 ? 0.5 : (k + 0.15 + r() * 0.7) / n),
        y: my + ih * (0.08 + r() * 0.84),
      }));
      const links: [number, number][] = [];
      for (let k = 0; k < n - 1; k++) links.push([k, k + 1]);
      for (let e = 0; e < Math.min(3, Math.floor(n / 3)); e++) {
        const a = Math.floor(r() * n), b = Math.floor(r() * n);
        if (Math.abs(a - b) > 1) links.push([a, b]);
      }
      return { i, pts, links };
    };

    const drawStar = (x: number, y: number, rad: number, col: string, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let a = 0; a < 4; a++) {
        const ang = (a * Math.PI) / 2;
        ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        ctx.lineTo(Math.cos(ang + Math.PI / 4) * rad * 0.28, Math.sin(ang + Math.PI / 4) * rad * 0.28);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawLayout = (lo: Layout | null, L: Line | undefined, t: number, alpha: number, isLive: boolean) => {
      if (!lo || !L) return;
      const h = live.current.hue;
      const now = performance.now();

      let wi = L.words.length;
      if (isLive) {
        wi = -1;
        L.words.forEach((w, j) => { if (t >= w.t0) wi = j; });
      }

      ctx.lineWidth = 1;
      for (const [a, b] of lo.links) {
        const hi = Math.max(a, b);
        if (hi > wi) continue;
        const p = lo.pts[a], q = lo.pts[b];
        const age = isLive ? Math.min(1, (t - L.words[hi].t0) / 0.5) : 1;
        ctx.strokeStyle = `hsla(${h},30%,80%,${0.35 * alpha})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (q.x - p.x) * age, p.y + (q.y - p.y) * age);
        ctx.stroke();
      }

      const base = Math.max(12, W / 48);
      for (let k = 0; k < lo.pts.length; k++) {
        if (k > wi) continue;
        const p = lo.pts[k];
        const active = isLive && k === wi;
        const pulse = active ? 1 + 0.08 * Math.sin(now / 180) : 1;

        if (active) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, base * 4);
          g.addColorStop(0, `hsla(${h},90%,70%,${0.45 * alpha})`);
          g.addColorStop(1, `hsla(${h},90%,70%,0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, base * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        drawStar(
          p.x, p.y,
          (active ? base * 0.9 : base * 0.42) * pulse,
          `hsl(${h},60%,${active ? 92 : 80}%)`,
          alpha * (active ? 1 : 0.8),
        );

        ctx.font = `${active ? 700 : 500} ${active ? base * 1.5 : base * 0.78}px system-ui, sans-serif`;
        ctx.fillStyle = `hsla(${h},${active ? 30 : 15}%,${active ? 95 : 78}%,${(active ? 1 : 0.7) * alpha})`;
        ctx.textBaseline = "middle";
        const word = L.words[k].w;
        const overflowsRight = p.x + base + ctx.measureText(word).width > W - 8;
        ctx.textAlign = overflowsRight ? "right" : "left";
        ctx.fillText(word, p.x + (overflowsRight ? -1 : 1) * base * 0.8, p.y + (active ? 0 : base * 0.55));
      }
    };

    const frame = () => {
      const { lines: ls, getPositionMs: pos } = live.current;

      if (ls !== lastLines) {
        lastLines = ls;
        cur = -2; layout = prev = null;
      }

      const t = pos() / 1000;
      let li = -1;
      ls.forEach((L, i) => { if (t >= L.t) li = i; });

      if (li !== cur) {
        prev = layout;
        cur = li;
        layout = li >= 0 ? makeLayout(li, ls[li]) : null;
        fade = 0;
      }
      fade = Math.min(1, fade + 0.04);

      // Background
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // Static background stars
      const bg = rng(5);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.05 + bg() * 0.12})`;
        ctx.fillRect(bg() * W, bg() * H, 1.2, 1.2);
      }

      if (prev && fade < 1) drawLayout(prev, ls[prev.i], t, 1 - fade, false);
      drawLayout(layout, layout ? ls[layout.i] : undefined, t, Math.min(1, 0.2 + fade), true);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block"
    />
  );
}
