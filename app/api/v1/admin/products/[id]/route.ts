import { getAdminSession } from "../../../../../lib/admin-session";
import { getAdminProduct, updateAdminProduct } from "../../../../../lib/products-repository";
import { productInput } from "../../../../../lib/catalog-validation";
import { apiError, checkOrigin, CommerceError, readJson } from "../../../../../lib/api-errors";
import { UUID_PATTERN } from "../../../../../lib/catalog-types";
export async function GET(_request: Request, {params}: {params:Promise<{id:string}>}) {
  if (!(await getAdminSession())) return Response.json({error:"Unauthorized"},{status:401});
  try { const {id}=await params; if (!UUID_PATTERN.test(id)) throw new CommerceError("Product not found.",404); const product=await getAdminProduct(id); if (!product) throw new CommerceError("Product not found.",404); return Response.json({product}); } catch(error) { return apiError(error); }
}
export async function PATCH(request: Request, {params}: {params:Promise<{id:string}>}) {
  if (!(await getAdminSession())) return Response.json({error:"Unauthorized"},{status:401});
  try { checkOrigin(request); const {id}=await params; if (!UUID_PATTERN.test(id)) throw new CommerceError("Product not found.",404); await updateAdminProduct(id,productInput(await readJson(request),true)); return Response.json({id}); } catch(error) { return apiError(error); }
}
