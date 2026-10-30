import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { products } from "../catalog";
import { withTransaction } from "./db";

type CartLine={productId:number;quantity:number};
export type Delivery={email:string;phone:string;firstName:string;lastName:string;street:string;city:string;postalCode:string};
export class CheckoutError extends Error{constructor(public code:string,message:string,public status=400){super(message)}}

export async function createCheckoutOrder(lines:CartLine[],delivery:Delivery,idempotencyKey:string){
 const normalized=lines.map(line=>{const product=products.find(p=>p.id===line.productId);if(!product)throw new CheckoutError("PRODUCT_UNAVAILABLE","A product in your cart is unavailable.",409);return{...line,title:product.name,sku:`NS-${String(product.id).padStart(4,"0")}`,unitPriceMinor:product.price*100,lineTotalMinor:product.price*100*line.quantity}});
 const subtotalMinor=normalized.reduce((sum,line)=>sum+line.lineTotalMinor,0);const shippingMinor=subtotalMinor>=1500000?0:65000;const totalMinor=subtotalMinor+shippingMinor;const requestHash=createHash("sha256").update(JSON.stringify({lines:normalized.map(({productId,quantity})=>({productId,quantity})),delivery})).digest("hex");
 return withTransaction(async client=>{
  const prior=await client.query<{request_hash:string;response_ref:string|null}>(`SELECT request_hash,response_ref FROM idempotency_keys WHERE scope='checkout' AND actor_key=$1 AND key=$2 FOR UPDATE`,[delivery.email,idempotencyKey]);
  if(prior.rows[0]){if(prior.rows[0].request_hash!==requestHash)throw new CheckoutError("IDEMPOTENCY_CONFLICT","This checkout key was already used for different details.",409);if(prior.rows[0].response_ref){const existing=await client.query<{order_number:string}>(`SELECT order_number FROM orders WHERE id=$1`,[prior.rows[0].response_ref]);if(existing.rows[0])return{orderId:prior.rows[0].response_ref,orderNumber:existing.rows[0].order_number,totalMinor}}}
  else await client.query(`INSERT INTO idempotency_keys (scope,actor_key,key,request_hash,expires_at) VALUES ('checkout',$1,$2,$3,now()+interval '24 hours')`,[delivery.email,idempotencyKey,requestHash]);
  const reserved:{variantId:string;warehouseId:string;line:typeof normalized[number]}[]=[];
  for(const line of normalized){const variant=await client.query<{id:string}>(`SELECT id FROM product_variants WHERE sku=$1 AND active=true`,[line.sku]);if(!variant.rows[0])throw new CheckoutError("PRODUCT_NOT_SYNCED",`${line.title} is not yet available for checkout.`,409);const stock=await client.query<{warehouse_id:string}>(`SELECT warehouse_id FROM inventory_stock WHERE variant_id=$1 AND on_hand-reserved >= $2 ORDER BY on_hand-reserved DESC LIMIT 1 FOR UPDATE`,[variant.rows[0].id,line.quantity]);if(!stock.rows[0])throw new CheckoutError("INSUFFICIENT_STOCK",`${line.title} no longer has enough stock.`,409);await client.query(`UPDATE inventory_stock SET reserved=reserved+$3 WHERE variant_id=$1 AND warehouse_id=$2`,[variant.rows[0].id,stock.rows[0].warehouse_id,line.quantity]);reserved.push({variantId:variant.rows[0].id,warehouseId:stock.rows[0].warehouse_id,line})}
  const orderNumber=`NS-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${randomBytes(3).toString("hex").toUpperCase()}`;const shippingSnapshot={name:`${delivery.firstName} ${delivery.lastName}`,phone:delivery.phone,street:delivery.street,city:delivery.city,postalCode:delivery.postalCode};
  const order=await client.query<{id:string}>(`INSERT INTO orders (order_number,email_normalized,order_status,payment_status,fulfillment_status,currency,subtotal_minor,shipping_minor,tax_minor,total_minor,shipping_snapshot) VALUES ($1,$2,'pending','unpaid','unfulfilled','PKR',$3,$4,0,$5,$6) RETURNING id`,[orderNumber,delivery.email,subtotalMinor,shippingMinor,totalMinor,JSON.stringify(shippingSnapshot)]);
  for(const entry of reserved)await client.query(`INSERT INTO order_items (order_id,variant_id,sku_snapshot,title_snapshot,quantity,unit_price_minor,line_total_minor) VALUES ($1,$2,$3,$4,$5,$6,$7)`,[order.rows[0].id,entry.variantId,entry.line.sku,entry.line.title,entry.line.quantity,entry.line.unitPriceMinor,entry.line.lineTotalMinor]);
  await client.query(`INSERT INTO outbox_events (type,aggregate_id,aggregate_version,payload) VALUES ('order.created',$1,1,$2)`,[order.rows[0].id,JSON.stringify({orderNumber,email:delivery.email,totalMinor})]);await client.query(`UPDATE idempotency_keys SET response_ref=$3 WHERE scope='checkout' AND actor_key=$1 AND key=$2`,[delivery.email,idempotencyKey,order.rows[0].id]);return{orderId:order.rows[0].id,orderNumber,totalMinor}
 })
}
