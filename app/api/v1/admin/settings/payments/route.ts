import { getAdminSession } from "../../../../../lib/admin-session";
import { getPaymentSettings, savePaymentSettings } from "../../../../../lib/payment-settings";
import { apiError, checkOrigin, readJson } from "../../../../../lib/api-errors";
export async function GET() {
  if (!(await getAdminSession())) return Response.json({error:"Unauthorized"},{status:401});
  try { return Response.json({settings:await getPaymentSettings()}); } catch(error) { return apiError(error); }
}
export async function PUT(request: Request) {
  if (!(await getAdminSession())) return Response.json({error:"Unauthorized"},{status:401});
  try { checkOrigin(request); return Response.json({settings:await savePaymentSettings(await readJson(request))}); } catch(error) { return apiError(error); }
}
