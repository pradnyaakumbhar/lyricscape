import { Request, Response, NextFunction } from "express";
import { getAccessToken } from "../lib/spotify";

// Attaches a valid access token to res.locals.token or sends 401.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = await getAccessToken(req, res);
  if (!token) {
    res.status(401).json({ error: "signed-out" });
    return;
  }
  res.locals.token = token;
  next();
}
