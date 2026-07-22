import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Admin access is a single shared passcode (ARCHITECTURE §2: "a separate admin passcode
// unlocks commissioner controls on Chris's devices"). Not per-device-remembered the casual
// way player PINs are — the signed cookie below expires in a few hours, so the passcode is
// effectively required every session, and it's a different secret from anything a player
// ever sees or handles.

const ADMIN_COOKIE_NAME = "gui_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function secret(): string {
  const passcode = process.env.ADMIN_PASSCODE;
  if (!passcode) throw new Error("ADMIN_PASSCODE is not configured");
  return passcode;
}

function sign(issuedAt: number): string {
  return createHmac("sha256", secret()).update(String(issuedAt)).digest("hex");
}

function makeToken(): string {
  const issuedAt = Date.now();
  return `${issuedAt}.${sign(issuedAt)}`;
}

function isValidToken(token: string): boolean {
  const [issuedAtRaw, signature] = token.split(".");
  const issuedAt = Number(issuedAtRaw);
  if (!issuedAt || !signature) return false;
  if (Date.now() - issuedAt > SESSION_TTL_MS) return false;

  const expected = sign(issuedAt);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPasscode(passcode: string): boolean {
  const expected = secret();
  const a = Buffer.from(passcode);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setAdminSession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/admin",
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE_NAME);
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  return token ? isValidToken(token) : false;
}

/** Throws if called outside an authenticated admin session — defense in depth for actions. */
export async function requireAdmin() {
  if (!(await isAdminAuthed())) {
    throw new Error("Admin session required");
  }
}
