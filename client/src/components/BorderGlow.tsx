import { useEffect, useRef } from "react";

function perimToXY(p: number, W: number, H: number): [number, number] {
  if (p < W)           return [p, 0];
  if (p < W + H)       return [W, p - W];
  if (p < 2 * W + H)  return [W - (p - W - H), H];
  return [0, H - (p - 2 * W - H)];
}

export default function BorderGlow({ hue = 268 }: { hue?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    let pos = 0;

    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (!W || !H) return;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    resize();

    const draw = () => {
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (!W || !H) { raf = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, W, H);

      const perim = 2 * (W + H);
      pos = (pos + 8) % perim;

      const tailLen = perim * 0.42;
      const steps = 300;

      const passes = [
        { alpha: 0.30, blur: 28, width: 12 },
        { alpha: 0.55, blur: 14, width:  5 },
        { alpha: 0.90, blur:  6, width:  2 },
      ];

      for (const pass of passes) {
        ctx.save();
        ctx.lineCap  = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = `hsl(${hue},85%,65%)`;
        ctx.shadowBlur  = pass.blur;
        ctx.lineWidth   = pass.width;

        const bands = 8;
        for (let b = 0; b < bands; b++) {
          const t0 = b / bands;
          const t1 = (b + 1) / bands;
          const brightness = Math.pow(t1, 1.6);

          ctx.beginPath();
          const i0 = Math.round(t0 * steps);
          const i1 = Math.round(t1 * steps);

          for (let i = i0; i <= i1; i++) {
            const t = i / steps;
            const p = (pos - tailLen * (1 - t) + perim) % perim;
            const [x, y] = perimToXY(p, W, H);
            if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }

          ctx.strokeStyle = `hsla(${hue},90%,72%,${(pass.alpha * brightness).toFixed(3)})`;
          ctx.stroke();
        }

        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [hue]);

  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
