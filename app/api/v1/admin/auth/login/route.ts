import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE,
  adminAuthConfigured,
  createAdminSession,
  verifyAdminCredentials,
} from "../../../../../lib/admin-auth";

export async function POST(request: Request) {
  if (!adminAuthConfigured()) {
    return NextResponse.json({ error: "Admin authentication is not configured.", code: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  }

  let input: { email?: unknown; password?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof input.email === "string" ? input.email.slice(0, 254) : "";
  const password = typeof input.password === "string" ? input.password.slice(0, 256) : "";
  if (!email || !password || !(await verifyAdminCredentials(email, password))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true, user: { email, role: "admin" } });
  response.cookies.set(ADMIN_COOKIE, createAdminSession(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
