import { getAdminSession } from "../../../../lib/admin-session";
import { getSalesReport } from "../../../../lib/sales-repository";
import { saleRanges, type SaleRange } from "../../../../lib/sales-report";

export async function GET(request: Request) {
  if (!(await getAdminSession())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const range = Number(params.get("range") ?? 30) as SaleRange;
  const page = Number(params.get("page") ?? 1);
  if (!saleRanges.includes(range) || !Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
    return Response.json({ error: "Invalid sales report range or page." }, { status: 400 });
  }
  try {
    return Response.json(await getSalesReport(range, page), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "The sales report is temporarily unavailable." }, { status: 503 });
  }
}
