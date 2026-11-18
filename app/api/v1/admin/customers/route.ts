import { apiError } from "../../../../lib/api-errors";
import { getAdminSession } from "../../../../lib/admin-session";
import { listCustomers } from "../../../../lib/customers-repository";

export async function GET(request: Request) {
  if (!(await getAdminSession())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
    return Response.json({ error: "Invalid page." }, { status: 400 });
  }
  try {
    return Response.json(await listCustomers(page), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
