import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminAuthConfigured, verifyAdminSession } from "../../../../../lib/admin-auth";

export async function GET() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const session = verifyAdminSession(token);
  return NextResponse.json({
    authenticated: Boolean(session),
    configured: adminAuthConfigured(),
    user: session ? { email: session.email, role: session.role } : null,
  });
}
