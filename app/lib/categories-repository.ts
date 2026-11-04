import "server-only";
import { query } from "./db";
import { CommerceError } from "./api-errors";
import type { Category, CategoryInput, MediaImage } from "./catalog-types";
type Row = {id:string;name:string;slug:string;description:string;is_active:boolean;image:MediaImage|null;product_count:number};
export async function listCategories(admin = false): Promise<Category[]> {
  const rows = (await query<Row>(`SELECT c.id,c.name,c.slug,c.description,c.is_active,
    CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object('id',m.id,'url','/api/media/'||m.id,'width',m.width,'height',m.height,'sizeBytes',m.size_bytes) END AS image,
    (SELECT count(*)::int FROM products p WHERE p.category_id=c.id ${admin ? "" : "AND p.status='published'"}) AS product_count
    FROM categories c LEFT JOIN media_assets m ON m.id=c.image_id ${admin ? "" : "WHERE c.is_active=true"} ORDER BY c.name`)).rows;
  return rows.map(r=>({id:r.id,name:r.name,slug:r.slug,description:r.description,isActive:r.is_active,image:r.image,productCount:r.product_count}));
}
export async function saveCategory(input: CategoryInput, id?: string) {
  const values = [input.name,input.slug,input.description,input.imageId,input.isActive];
  const result = id ? await query<{id:string}>("UPDATE categories SET name=$1,slug=$2,description=$3,image_id=$4,is_active=$5,updated_at=now() WHERE id=$6 RETURNING id",[...values,id]) : await query<{id:string}>("INSERT INTO categories(name,slug,description,image_id,is_active) VALUES($1,$2,$3,$4,$5) RETURNING id",values);
  if (!result.rows[0]) throw new CommerceError("Category not found.",404);
  return result.rows[0].id;
}
export async function deleteCategory(id: string) { const result=await query("DELETE FROM categories WHERE id=$1 RETURNING id",[id]); if (!result.rowCount) throw new CommerceError("Category not found.",404); }
