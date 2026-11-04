import { getAdminSession } from "../../../../lib/admin-session";
import { createAdminProduct, listAdminProducts } from "../../../../lib/products-repository";
import { productInput } from "../../../../lib/catalog-validation";
import { apiError, checkOrigin, readJson } from "../../../../lib/api-errors";
export async function GET() {
  if (!(await getAdminSession())) return Response.json({error:"Unauthorized"},{status:401});
  try { return Response.json({products:await listAdminProducts()}); } catch(error) { return apiError(error); }
}
export async function POST(request: Request) {
  if (!(await getAdminSession())) return Response.json({error:"Unauthorized"},{status:401});
  try { checkOrigin(request); const id = await createAdminProduct(productInput(await readJson(request))); return Response.json({id},{status:201}); } catch(error) { return apiError(error); }
}
