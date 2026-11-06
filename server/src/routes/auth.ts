import { Router } from "express";
import { randomBytes } from "node:crypto";
import {
  authorizeUrl,
  b64url,
  clearTokens,
  clientId,
  exchangeCode,
  generatePKCE,
  redirectUri,
  SCOPES,
  storeTokens,
} from "../lib/spotify";

const router = Router();

// GET /auth/login — generate PKCE pair + state, redirect to Spotify
router.get("/login", (_req, res) => {
  const { verifier, challenge } = generatePKCE();
  const state = b64url(randomBytes(16));

  const url = new URL(authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    scope: SCOPES,
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  }).toString();

  res.cookie("sp_verifier", verifier, { httpOnly: true, sameSite: "lax", maxAge: 600_000 });
  res.cookie("sp_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600_000 });
  res.redirect(url.toString());
});

// GET /auth/callback — exchange code for tokens, redirect to client
router.get("/callback", async (req, res) => {
  const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
  const { code, state, error } = req.query as Record<string, string>;
  const verifier: string | undefined = req.cookies.sp_verifier;
  const expectedState: string | undefined = req.cookies.sp_state;

  res.clearCookie("sp_verifier");
  res.clearCookie("sp_state");

  if (error || !code || !verifier || state !== expectedState) {
    return res.redirect(`${clientUrl}?auth=failed`);
  }

  try {
    const tokens = await exchangeCode(code, verifier);
    storeTokens(res, tokens);
    res.redirect(clientUrl);
  } catch {
    res.redirect(`${clientUrl}?auth=failed`);
  }
});

// POST /auth/logout — clear cookies
router.post("/logout", (_req, res) => {
  clearTokens(res);
  res.json({ ok: true });
});

export default router;
