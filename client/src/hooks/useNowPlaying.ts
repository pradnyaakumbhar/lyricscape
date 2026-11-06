import { useCallback, useEffect, useRef, useState } from "react";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  image: string | null;
}

export interface NowPlaying {
  isPlaying: boolean;
  track: Track | null;
  progressMs: number;
}

export type AuthStatus = "loading" | "signed-out" | "ready";

const POLL_MS = 3000;

/**
 * Polls /api/spotify/now-playing every 3 s.
 * getPositionMs() extrapolates the playhead locally between polls so
 * animation stays smooth; each poll re-anchors it to correct drift and
 * pick up seeks, pauses, or track changes.
 */
export function useNowPlaying() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [data, setData] = useState<NowPlaying | null>(null);
  const anchor = useRef({ progressMs: 0, at: 0, playing: false, durationMs: 0 });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      let next = POLL_MS;
      try {
        const sent = performance.now();
        const res = await fetch("/api/spotify/now-playing", { credentials: "include" });
        const received = performance.now();

        if (res.status === 401) {
          setStatus("signed-out");
        } else if (res.status === 429) {
          next = Number(res.headers.get("Retry-After") ?? 5) * 1000;
        } else if (res.ok) {
          const body: NowPlaying = await res.json();
          // Spotify sampled progress mid-request; anchor at the midpoint to minimise drift.
          anchor.current = {
            progressMs: body.progressMs,
            at: (sent + received) / 2,
            playing: body.isPlaying,
            durationMs: body.track?.durationMs ?? 0,
          };
          setData((prev) => (sameState(prev, body) ? prev : body));
          setStatus("ready");
        }
      } catch {
        // network blip – retry next tick
      }
      if (!stopped) timer = setTimeout(tick, next);
    };

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const getPositionMs = useCallback(() => {
    const a = anchor.current;
    const pos = a.playing ? a.progressMs + (performance.now() - a.at) : a.progressMs;
    return a.durationMs ? Math.min(pos, a.durationMs) : pos;
  }, []);

  return { status, data, getPositionMs };
}

function sameState(a: NowPlaying | null, b: NowPlaying) {
  return !!a && a.isPlaying === b.isPlaying && a.track?.id === b.track?.id;
}
