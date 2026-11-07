import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { spotifyFetch } from "../lib/spotify";

const router = Router();

// GET /api/spotify/now-playing — proxy Spotify's currently-playing endpoint
router.get("/now-playing", requireAuth, async (_req, res) => {
  const token: string = res.locals.token;

  const upstream: globalThis.Response = await spotifyFetch("/me/player?additional_types=track", token);

  if (upstream.status === 429) {
    res.set("Retry-After", upstream.headers.get("Retry-After") ?? "5");
    res.status(429).json({ error: "rate-limited" });
    return;
  }

  // 204 = nothing playing or private session
  if (upstream.status === 204 || !upstream.ok) {
    res.json({ isPlaying: false, track: null, progressMs: 0 });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await upstream.json();
  const item = data.item;

  if (!item || data.currently_playing_type !== "track") {
    res.json({ isPlaying: false, track: null, progressMs: 0 });
    return;
  }

  res.json({
    isPlaying: Boolean(data.is_playing),
    progressMs: data.progress_ms ?? 0,
    track: {
      id: item.id,
      title: item.name,
      artist: (item.artists ?? []).map((a: { name: string }) => a.name).join(", "),
      album: item.album?.name ?? "",
      durationMs: item.duration_ms,
      image: item.album?.images?.[1]?.url ?? item.album?.images?.[0]?.url ?? null,
    },
  });
});

// GET /api/spotify/token — give the client a valid access token for the Web Playback SDK
// The SDK needs it directly (it cannot go through a cookie proxy).
router.get("/token", requireAuth, (_req, res) => {
  res.json({ accessToken: res.locals.token });
});

// GET /api/spotify/me — debug: returns the current user's Spotify profile
router.get("/me", requireAuth, async (_req, res) => {
  const token: string = res.locals.token;
  const upstream = await spotifyFetch("/me", token);
  const text = await upstream.text();
  try {
    res.json(JSON.parse(text));
  } catch {
    res.status(upstream.status).json({ raw: text });
  }
});

export default router;
