import { getAdminSession } from "../../../../../lib/admin-session";
import { deleteCategory, saveCategory } from "../../../../../lib/categories-repository";
import { categoryInput } from "../../../../../lib/catalog-validation";
import { apiError, checkOrigin, CommerceError, readJson } from "../../../../../lib/api-errors";
import { UUID_PATTERN } from "../../../../../lib/catalog-types";
async function authorize(request: Request, params: Promise<{id:string}>) { if (!(await getAdminSession())) throw new CommerceError("Unauthorized",401); checkOrigin(request); const {id}=await params; if (!UUID_PATTERN.test(id)) throw new CommerceError("Category not found.",404); return id; }
export async function PATCH(request: Request, {params}: {params:Promise<{id:string}>}) {
  try { const id=await authorize(request,params); await saveCategory(categoryInput(await readJson(request)),id); return Response.json({id}); } catch(error) { return apiError(error); }
}
export async function DELETE(request: Request, {params}: {params:Promise<{id:string}>}) { try { await deleteCategory(await authorize(request,params)); return Response.json({deleted:true}); } catch(error) { return apiError(error); } }
