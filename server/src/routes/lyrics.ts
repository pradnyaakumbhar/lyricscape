import { Router, Request, Response } from "express";

const router = Router();
const LRCLIB = "https://lrclib.net/api";
const UA = { "User-Agent": "lyric-constellations/0.1 (personal project)" };

interface LrcLibHit {
  syncedLyrics: string | null;
  duration: number;
}

async function lrclibGet<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const res = await fetch(`${LRCLIB}/${path}?${new URLSearchParams(params)}`, { headers: UA });
  return res.ok ? (res.json() as Promise<T>) : null;
}

// GET /api/lyrics?title=&artist=&album=&duration=
router.get("/", async (req: Request, res: Response) => {
  const { title, artist, album = "", duration = "0" } = req.query as Record<string, string>;

  if (!title || !artist) {
    res.status(400).json({ error: "title and artist are required" });
    return;
  }

  const dur = Math.round(Number(duration));

  // Exact match first (duration helps pick the right version)
  const exact = await lrclibGet<LrcLibHit>("get", {
    track_name: title,
    artist_name: artist,
    album_name: album,
    duration: String(dur),
  });
  if (exact?.syncedLyrics) {
    res.json({ synced: exact.syncedLyrics });
    return;
  }

  // Fall back to search, pick closest duration with synced lyrics
  const hits = await lrclibGet<LrcLibHit[]>("search", { track_name: title, artist_name: artist });
  const best = (hits ?? [])
    .filter((h) => h.syncedLyrics)
    .sort((a, b) => Math.abs(a.duration - dur) - Math.abs(b.duration - dur))[0];

  res.json({ synced: best?.syncedLyrics ?? null });
});

export default router;
