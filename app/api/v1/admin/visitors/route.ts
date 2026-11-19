import { getAdminSession } from "../../../../lib/admin-session";
import { UUID_PATTERN } from "../../../../lib/catalog-types";
import { getVisitorReport } from "../../../../lib/storefront-visitors-repository";

export async function GET(request: Request) {
  if (!(await getAdminSession())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? 1);
  const visitor = params.get("visitor");
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 || (visitor !== null && !UUID_PATTERN.test(visitor))) {
    return Response.json({ error: "Invalid activity filter." }, { status: 400 });
  }
  try {
    return Response.json(await getVisitorReport(page, visitor), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Visitor activity is temporarily unavailable." }, { status: 503 });
  }
}
