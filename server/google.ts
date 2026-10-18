import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import type { Express, Request, Response } from "express";
import { createAppSession, googleConfiguration, SPACEFORM_SESSION_COOKIE } from "./auth";
import { upsertGoogleAccount, ensureWorkspaceForAccount } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";

const STATE_COOKIE = "spaceform_google_state";
const NONCE_COOKIE = "spaceform_google_nonce";
function config() { return { clientId: process.env.GOOGLE_CLIENT_ID ?? "", clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "" }; }
function clearOAuthCookies(res: Response, req: Request) {
  const options = { ...getSessionCookieOptions(req), maxAge: 0 };
  res.clearCookie(STATE_COOKIE, options);
  res.clearCookie(NONCE_COOKIE, options);
}
function constantTimeMatch(expected: string, actual: string) {
  if (!expected || !actual || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export function registerSpaceFormGoogleRoutes(app: Express) {
  app.get("/api/auth/google", (req, res) => {
    if (!googleConfiguration()) { res.status(503).json({ error: "Google sign-in is unavailable until GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI are configured." }); return; }
    const state = randomBytes(24).toString("base64url");
    const nonce = randomBytes(24).toString("base64url");
    const options = { ...getSessionCookieOptions(req), maxAge: 600000 };
    res.cookie(STATE_COOKIE, state, options);
    res.cookie(NONCE_COOKIE, nonce, options);
    const { clientId, redirectUri } = config();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("access_type", "online");
    res.redirect(url.toString());
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    if (!googleConfiguration()) { res.status(503).json({ error: "Google sign-in is not configured." }); return; }
    const cookies = parse(req.headers.cookie ?? "");
    const expectedState = cookies[STATE_COOKIE] ?? "";
    const expectedNonce = cookies[NONCE_COOKIE] ?? "";
    const returnedState = typeof req.query.state === "string" ? req.query.state : "";
    if (!constantTimeMatch(expectedState, returnedState)) { clearOAuthCookies(res, req); res.status(400).json({ error: "Invalid Google OAuth state." }); return; }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) { clearOAuthCookies(res, req); res.status(400).json({ error: "Google did not return an authorization code." }); return; }
    clearOAuthCookies(res, req);
    try {
      const { clientId, clientSecret, redirectUri } = config();
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      });
      const token = await tokenResponse.json() as { access_token?: string; id_token?: string; error?: string };
      if (!tokenResponse.ok || !token.access_token || !token.id_token) throw new Error(token.error || "Google token exchange failed.");

      const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`);
      const claims = await verifyResponse.json() as { aud?: string; iss?: string; sub?: string; nonce?: string; error_description?: string };
      const validIssuer = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
      if (!verifyResponse.ok || claims.aud !== clientId || !validIssuer || !claims.sub || !constantTimeMatch(expectedNonce, claims.nonce ?? "")) {
        throw new Error(claims.error_description || "Google returned an invalid identity token.");
      }

      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
      const profile = await profileResponse.json() as { sub?: string; email?: string; name?: string; email_verified?: boolean };
      if (!profileResponse.ok || profile.sub !== claims.sub || !profile.email || profile.email_verified !== true) throw new Error("Google returned an unusable account.");
      const account = await upsertGoogleAccount({ subject: profile.sub, email: profile.email.trim().toLowerCase(), name: profile.name?.trim() || profile.email });
      await ensureWorkspaceForAccount(account.id);
      const session = await createAppSession(account.id);
      res.cookie(SPACEFORM_SESSION_COOKIE, session.token, { ...getSessionCookieOptions(req), maxAge: session.expiresAt.getTime() - Date.now() });
      res.redirect("/dashboard");
    } catch (error) {
      console.error("[SpaceForm Google OAuth] callback failed:", error);
      res.status(502).json({ error: "Google sign-in could not be completed. Try email sign-in instead." });
    }
  });
}
