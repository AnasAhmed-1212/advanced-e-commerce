import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "./admin-auth";
export async function getAdminSession(){return verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)}
