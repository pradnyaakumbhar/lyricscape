import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { spotifyFetch } from "../lib/spotify";

const router = Router();

const proxyStatus = (u: globalThis.Response) => (u.ok ? 204 : u.status);

// PUT /api/player/play
router.put("/play", requireAuth, async (req, res) => {
  const u: globalThis.Response = await spotifyFetch("/me/player/play", res.locals.token as string, {
    method: "PUT",
    body: JSON.stringify(req.body),
  });
  res.status(proxyStatus(u)).end();
});

// PUT /api/player/pause
router.put("/pause", requireAuth, async (_req, res) => {
  const u: globalThis.Response = await spotifyFetch("/me/player/pause", res.locals.token as string, { method: "PUT" });
  res.status(proxyStatus(u)).end();
});

// POST /api/player/next
router.post("/next", requireAuth, async (_req, res) => {
  const u: globalThis.Response = await spotifyFetch("/me/player/next", res.locals.token as string, { method: "POST" });
  res.status(proxyStatus(u)).end();
});

// POST /api/player/prev
router.post("/prev", requireAuth, async (_req, res) => {
  const u: globalThis.Response = await spotifyFetch("/me/player/previous", res.locals.token as string, { method: "POST" });
  res.status(proxyStatus(u)).end();
});

// PUT /api/player/seek — body: { positionMs: number }
router.put("/seek", requireAuth, async (req, res) => {
  const positionMs = Number(req.body.positionMs ?? 0);
  const u: globalThis.Response = await spotifyFetch(
    `/me/player/seek?position_ms=${positionMs}`,
    res.locals.token as string,
    { method: "PUT" },
  );
  res.status(proxyStatus(u)).end();
});

// PUT /api/player/transfer — body: { deviceId: string }
// Transfers playback to the browser (Web Playback SDK device).
router.put("/transfer", requireAuth, async (req, res) => {
  const { deviceId } = req.body as { deviceId: string };
  const u: globalThis.Response = await spotifyFetch("/me/player", res.locals.token as string, {
    method: "PUT",
    body: JSON.stringify({ device_ids: [deviceId], play: true }),
  });
  res.status(proxyStatus(u)).end();
});

export default router;
