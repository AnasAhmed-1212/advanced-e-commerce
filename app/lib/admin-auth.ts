import "server-only";

import { createHmac, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export const ADMIN_COOKIE = "northstar_admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 12;

type SessionPayload = {
  email: string;
  role: "admin";
  exp: number;
};

export function adminAuthConfigured() {
  return Boolean(
    process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD_HASH &&
      process.env.ADMIN_SESSION_SECRET &&
      process.env.ADMIN_SESSION_SECRET.length >= 32,
  );
}

export async function verifyAdminCredentials(email: string, password: string) {
  if (!adminAuthConfigured()) return false;
  if (email.trim().toLowerCase() !== process.env.ADMIN_EMAIL!.trim().toLowerCase()) return false;

  const [salt, expectedHex] = process.env.ADMIN_PASSWORD_HASH!.split(":");
  if (!salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;

  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signature(value: string) {
  return createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update(value).digest("base64url");
}

export function createAdminSession(email: string) {
  const payload: SessionPayload = {
    email: email.trim().toLowerCase(),
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body)}`;
}

export function verifyAdminSession(token?: string): SessionPayload | null {
  if (!token || !adminAuthConfigured()) return null;
  const [body, suppliedSignature] = token.split(".");
  if (!body || !suppliedSignature) return null;

  const expectedSignature = signature(body);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (payload.role !== "admin" || !payload.email || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
