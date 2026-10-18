import { promisify } from "node:util";
import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual, createHash } from "node:crypto";
import type { Request } from "express";
import { parse as parseCookie } from "cookie";
import { getAccountByEmail, getAccountById, getAccountBySessionHash, insertAccount, insertSession, revokeSessionByHash, ensureWorkspaceForAccount } from "./db";
import type { SfAccount } from "../drizzle/schema";

const scrypt = promisify(nodeScrypt);
export const SPACEFORM_SESSION_COOKIE = "spaceform_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 200) throw new Error("Password must be at least 12 characters.");
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  if (!encoded?.startsWith("scrypt$")) return false;
  const [, salt, expectedHex] = encoded.split("$");
  if (!salt || !expectedHex) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function hashSessionToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function newOpaqueSessionToken() { return randomBytes(32).toString("base64url"); }

export function publicAccount(account: SfAccount) {
  return { id: account.id, name: account.name, email: account.email, loginMethod: account.provider, role: "user" as const, createdAt: account.createdAt, updatedAt: account.updatedAt, lastSignedIn: account.updatedAt };
}
export async function signupAccount(name: string, email: string, password: string) {
  const normalized = normalizeEmail(email);
  const existing = await getAccountByEmail(normalized);
  if (existing) throw new Error("An account with this email already exists.");
  const account = await insertAccount({ id: randomUUID(), name: name.trim(), email: normalized, passwordHash: await hashPassword(password), provider: "password" });
  await ensureWorkspaceForAccount(account.id);
  return account;
}
export async function loginAccount(email: string, password: string) {
  const account = await getAccountByEmail(normalizeEmail(email));
  if (!account || !(await verifyPassword(password, account.passwordHash))) throw new Error("Invalid email or password.");
  return account;
}
export async function createAppSession(accountId: string) {
  const token = newOpaqueSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await insertSession({ id: randomUUID(), accountId, tokenHash: hashSessionToken(token), expiresAt });
  return { token, expiresAt };
}
export async function accountFromRequest(req: Request): Promise<{ account: SfAccount; token: string } | null> {
  const token = parseCookie(req.headers.cookie ?? "")[SPACEFORM_SESSION_COOKIE];
  if (!token) return null;
  const account = await getAccountBySessionHash(hashSessionToken(token));
  return account ? { account, token } : null;
}
export async function revokeAppSession(token: string) { await revokeSessionByHash(hashSessionToken(token)); }
export function googleConfiguration() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}
