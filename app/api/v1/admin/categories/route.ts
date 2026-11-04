import { getAdminSession } from "../../../../lib/admin-session";
import { listCategories, saveCategory } from "../../../../lib/categories-repository";
import { categoryInput } from "../../../../lib/catalog-validation";
import { apiError, checkOrigin, readJson } from "../../../../lib/api-errors";
export async function GET() {
  if (!(await getAdminSession())) return Response.json({error:"Unauthorized"},{status:401});
  try { return Response.json({categories:await listCategories(true)}); } catch(error) { return apiError(error); }
}
export async function POST(request: Request) {
  if (!(await getAdminSession())) return Response.json({error:"Unauthorized"},{status:401});
  try { checkOrigin(request); return Response.json({id:await saveCategory(categoryInput(await readJson(request)))},{status:201}); } catch(error) { return apiError(error); }
}
