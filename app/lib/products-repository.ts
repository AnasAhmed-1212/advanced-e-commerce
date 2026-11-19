import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query, withTransaction } from "./db";
import { DEFAULT_DELIVERY_CHARGE_MINOR } from "./shipping";
import { CommerceError } from "./api-errors";
import type { AdminProduct, MediaImage, ProductInput, ShopProduct } from "./catalog-types";
type ProductRow = { id: string; title: string; slug: string; description: string; category_id: string | null; category_name: string; status: AdminProduct["status"]; version: number; price_minor: string | null; previous_price_minor: string | null; delivery_charge_minor: string | null; unit_cost_minor: string | null; currency: string | null; on_hand: number; reserved: number; images: MediaImage[] };
const selection = `SELECT p.id,p.title,p.slug,p.description,p.category_id,COALESCE(c.name,'Uncategorized') AS category_name,p.status,p.version,v.price_minor,v.previous_price_minor,to_jsonb(v)->>'delivery_charge_minor' AS delivery_charge_minor,to_jsonb(v)->>'unit_cost_minor' AS unit_cost_minor,v.currency,
  COALESCE(stock.on_hand,0)::int AS on_hand,COALESCE(stock.reserved,0)::int AS reserved,
  COALESCE((SELECT json_agg(json_build_object('id',m.id,'url','/api/media/' || m.id,'width',m.width,'height',m.height,'sizeBytes',m.size_bytes) ORDER BY pi.position)
    FROM product_images pi JOIN media_assets m ON m.id=pi.image_id WHERE pi.product_id=p.id),'[]'::json) AS images
  FROM products p LEFT JOIN categories c ON c.id=p.category_id
  LEFT JOIN LATERAL (SELECT * FROM product_variants WHERE product_id=p.id AND active=true ORDER BY created_at,id LIMIT 1) v ON true
  LEFT JOIN LATERAL (SELECT SUM(on_hand) AS on_hand,SUM(reserved) AS reserved FROM inventory_stock WHERE variant_id=v.id) stock ON true`;
const previousPrice = (row: ProductRow) => row.previous_price_minor == null ? null : Number(row.previous_price_minor);
const deliveryCharge = (row: ProductRow) => Number(row.delivery_charge_minor ?? DEFAULT_DELIVERY_CHARGE_MINOR);
const adminProduct = (r: ProductRow): AdminProduct => ({ id:r.id,title:r.title,slug:r.slug,description:r.description,categoryId:r.category_id,categoryName:r.category_name,status:r.status,version:r.version,priceMinor:Number(r.price_minor ?? 0),previousPriceMinor:previousPrice(r),deliveryChargeMinor:deliveryCharge(r),unitCostMinor:r.unit_cost_minor == null ? null : Number(r.unit_cost_minor),currency:r.currency ?? "PKR",onHand:r.on_hand,reserved:r.reserved,images:r.images });
export async function listAdminProducts(): Promise<AdminProduct[]> { return (await query<ProductRow>(selection + " ORDER BY p.updated_at DESC")).rows.map(adminProduct); }
export async function getAdminProduct(id: string) { const result = await query<ProductRow>(selection + " WHERE p.id=$1", [id]); return result.rows[0] ? adminProduct(result.rows[0]) : null; }
export async function listShopProducts(): Promise<ShopProduct[]> {
  const rows = (await query<ProductRow>(selection + " WHERE p.status='published' AND c.is_active=true AND v.id IS NOT NULL ORDER BY p.published_at DESC,p.id")).rows;
  return rows.map(r => ({ id:r.id,name:r.title,slug:r.slug,description:r.description,categoryId:r.category_id!,category:r.category_name,price:Number(r.price_minor)/100,priceMinor:Number(r.price_minor),previousPriceMinor:previousPrice(r),deliveryChargeMinor:deliveryCharge(r),available:Math.max(0,r.on_hand-r.reserved),images:r.images }));
}
export async function getShopProduct(idOrSlug: string) { return (await listShopProducts()).find(p => p.id === idOrSlug || p.slug === idOrSlug) ?? null; }
async function validateReferences(client: PoolClient, input: ProductInput) {
  const category = await client.query<{is_active:boolean}>("SELECT is_active FROM categories WHERE id=$1 FOR SHARE",[input.categoryId]);
  if (!category.rows[0]) throw new CommerceError("The selected category no longer exists.",409);
  if (input.status === "published" && !category.rows[0].is_active) throw new CommerceError("Activate this category before publishing its products.");
  if (input.imageIds.length) {
    const images = await client.query("SELECT id FROM media_assets WHERE id=ANY($1::uuid[]) FOR KEY SHARE",[input.imageIds]);
    if (images.rows.length !== input.imageIds.length) throw new CommerceError("One of the uploaded images is missing. Upload it again.");
  }
}
async function saveImages(client: PoolClient, productId: string, ids: string[]) {
  await client.query("DELETE FROM product_images WHERE product_id=$1",[productId]);
  for (const [position,id] of ids.entries()) await client.query("INSERT INTO product_images(product_id,image_id,position) VALUES($1,$2,$3)",[productId,id,position]);
}
export async function createAdminProduct(input: ProductInput) {
  return withTransaction(async client => {
    await validateReferences(client,input);
    const id = randomUUID();
    await client.query("INSERT INTO products(id,title,slug,description,category_id,status,published_at) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $6='published' THEN now() ELSE NULL END)",[id,input.title,input.slug,input.description,input.categoryId,input.status]);
    const variant = await client.query<{id:string}>("INSERT INTO product_variants(product_id,sku,price_minor,currency,previous_price_minor,delivery_charge_minor,unit_cost_minor) VALUES($1,$2,$3,'PKR',$4,$5,$6) RETURNING id",[id,`AUTO-${id}`,input.priceMinor,input.previousPriceMinor ?? null,input.deliveryChargeMinor ?? DEFAULT_DELIVERY_CHARGE_MINOR,input.unitCostMinor ?? null]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext('commerce-main-warehouse'))");
    let warehouse = await client.query<{id:string}>("SELECT id FROM warehouses ORDER BY created_at,id LIMIT 1");
    if (!warehouse.rows[0]) warehouse = await client.query<{id:string}>("INSERT INTO warehouses(name) VALUES('Main warehouse') RETURNING id");
    await client.query("INSERT INTO inventory_stock(variant_id,warehouse_id,on_hand,reserved) VALUES($1,$2,$3,0)",[variant.rows[0].id,warehouse.rows[0].id,input.onHand]);
    await saveImages(client,id,input.imageIds);
    return id;
  });
}
export async function updateAdminProduct(id: string, input: ProductInput) {
  return withTransaction(async client => {
    const current = await client.query<{version:number}>("SELECT version FROM products WHERE id=$1 FOR UPDATE",[id]);
    if (!current.rows[0]) throw new CommerceError("Product not found.",404);
    if (current.rows[0].version !== input.version) throw new CommerceError("This product was changed in another window. Close and reopen it before saving.",409);
    await validateReferences(client,input);
    const variant = await client.query<{id:string}>("SELECT id FROM product_variants WHERE product_id=$1 AND active=true ORDER BY created_at,id LIMIT 1 FOR UPDATE",[id]);
    if (!variant.rows[0]) throw new CommerceError("This product has no active inventory record.",409);
    const stock = await client.query<{warehouse_id:string;on_hand:number;reserved:number}>("SELECT warehouse_id,on_hand,reserved FROM inventory_stock WHERE variant_id=$1 ORDER BY warehouse_id FOR UPDATE",[variant.rows[0].id]);
    const reserved = stock.rows.reduce((sum,row) => sum+row.reserved,0);
    if (input.onHand < reserved) throw new CommerceError(`Stock cannot be below ${reserved} units already reserved for orders.`,409);
    if (!stock.rows.length) throw new CommerceError("This product has no warehouse stock record.",409);
    for (const [i,row] of stock.rows.entries()) await client.query("UPDATE inventory_stock SET on_hand=$3 WHERE variant_id=$1 AND warehouse_id=$2",[variant.rows[0].id,row.warehouse_id,row.reserved+(i===0?input.onHand-reserved:0)]);
    await client.query("UPDATE product_variants SET price_minor=$2,previous_price_minor=CASE WHEN $4::boolean THEN $3::bigint WHEN previous_price_minor > $2 THEN previous_price_minor ELSE NULL END,delivery_charge_minor=COALESCE($5,delivery_charge_minor),unit_cost_minor=CASE WHEN $7::boolean THEN $6::bigint ELSE unit_cost_minor END WHERE id=$1",[variant.rows[0].id,input.priceMinor,input.previousPriceMinor ?? null,input.previousPriceMinor !== undefined,input.deliveryChargeMinor ?? null,input.unitCostMinor ?? null,input.unitCostMinor !== undefined]);
    await client.query("UPDATE products SET title=$2,slug=$3,description=$4,category_id=$5,status=$6,version=version+1,updated_at=now(),published_at=CASE WHEN $6='published' THEN COALESCE(published_at,now()) ELSE published_at END WHERE id=$1",[id,input.title,input.slug,input.description,input.categoryId,input.status]);
    await saveImages(client,id,input.imageIds);
    return id;
  });
}
