import { Request, Response as ExpressResponse } from "express";
import { createHash, randomBytes } from "node:crypto";

const ACCOUNTS = "https://accounts.spotify.com";

export const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "streaming",
  "user-read-email",
  "user-read-private",
].join(" ");

// ── PKCE helpers ─────────────────────────────────────────────────────────────

export const b64url = (b: Buffer) => b.toString("base64url");

export function generatePKCE() {
  const verifier = b64url(randomBytes(64));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function storeTokens(
  res: ExpressResponse,
  tokens: { access_token: string; expires_in: number; refresh_token?: string },
  existingRefresh?: string,
) {
  const expiresAt = Date.now() + (tokens.expires_in - 30) * 1000;
  res.cookie("sp_access", tokens.access_token, { ...COOKIE_OPTS, maxAge: tokens.expires_in * 1000 });
  res.cookie("sp_expires", String(expiresAt), { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });
  const refresh = tokens.refresh_token ?? existingRefresh;
  if (refresh) res.cookie("sp_refresh", refresh, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

export function clearTokens(res: ExpressResponse) {
  for (const name of ["sp_access", "sp_expires", "sp_refresh"]) {
    res.clearCookie(name, { path: "/" });
  }
}

// ── Token exchange & refresh ──────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("SPOTIFY_CLIENT_ID"),
      client_secret: requireEnv("SPOTIFY_CLIENT_SECRET"),
      ...params,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token request failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export const exchangeCode = (code: string, verifier: string) =>
  tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: requireEnv("SPOTIFY_REDIRECT_URI"),
    code_verifier: verifier,
  });

export const refreshAccessToken = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

// ── Get a valid access token from the request cookies (refresh if needed) ────

export async function getAccessToken(
  req: Request,
  res: ExpressResponse,
): Promise<string | null> {
  const access: string | undefined = req.cookies.sp_access;
  const expires = Number(req.cookies.sp_expires ?? 0);

  if (access && Date.now() < expires) return access;

  const refresh: string | undefined = req.cookies.sp_refresh;
  if (!refresh) return null;

  try {
    const tokens = await refreshAccessToken(refresh);
    storeTokens(res, tokens, refresh);
    return tokens.access_token;
  } catch {
    return null;
  }
}

// ── Spotify API fetch wrapper ─────────────────────────────────────────────────

export async function spotifyFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<globalThis.Response> {
  return fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export const clientId = () => requireEnv("SPOTIFY_CLIENT_ID");
export const redirectUri = () => requireEnv("SPOTIFY_REDIRECT_URI");
export const authorizeUrl = `${ACCOUNTS}/authorize`;
