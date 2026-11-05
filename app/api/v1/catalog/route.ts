import { listShopProducts } from "../../../lib/products-repository";
import { listCategories } from "../../../lib/categories-repository";
import { connection } from "next/server";
import { logCatalogFailure } from "../../../lib/api-errors";
export async function GET() {
  await connection();
  try { const [products,categories]=await Promise.all([listShopProducts(),listCategories()]); return Response.json({products,categories},{headers:{"Cache-Control":"no-store"}}); } catch(error) { logCatalogFailure(error); return Response.json({error:"The store is temporarily unavailable. Please try again."},{status:503}); }
}
