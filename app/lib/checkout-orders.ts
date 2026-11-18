import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { withTransaction } from "./db";
import { CommerceError } from "./api-errors";
import { getPaymentSettings } from "./payment-settings";
import type { CartLine } from "./checkout-validation";
import { DEFAULT_DELIVERY_CHARGE_MINOR, shippingMinor } from "./shipping";
import { receiptToken } from "./order-receipt";
import type { PaymentSettings } from "./catalog-types";

export type Delivery={email:string;phone:string;firstName:string;lastName:string;street:string;city:string;postalCode:string};
export class CheckoutError extends CommerceError { constructor(public code:string,message:string,status=400){super(message,status);} }
type CheckoutProduct={id:string;title:string;variant_id:string;sku:string;price_minor:string;delivery_charge_minor:string|null;currency:string};
export async function createCheckoutOrder(lines:CartLine[],delivery:Delivery,idempotencyKey:string,paymentMethod:"cod"|"raast"="cod",userId:string|null=null,expectedTotalMinor?:number){
  const requestHash=createHash("sha256").update(JSON.stringify({lines,delivery,paymentMethod})).digest("hex");
  const currentPaymentSettings=paymentMethod==="raast"?await getPaymentSettings():null;
  return withTransaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`checkout:${delivery.email}:${idempotencyKey}`]);
    const prior=await client.query<{request_hash:string;response_ref:string|null}>("SELECT request_hash,response_ref FROM idempotency_keys WHERE scope='checkout' AND actor_key=$1 AND key=$2",[delivery.email,idempotencyKey]);
    if(prior.rows[0]){
      if(prior.rows[0].request_hash!==requestHash)throw new CheckoutError("IDEMPOTENCY_CONFLICT","This checkout was already submitted with different details.",409);
      if(prior.rows[0].response_ref){
        const existing=await client.query<{id:string;order_number:string;total_minor:string;payment_method:string;payment_snapshot:PaymentSettings|null}>("SELECT id,order_number,total_minor,payment_method,payment_snapshot FROM orders WHERE id=$1",[prior.rows[0].response_ref]);
        const order=existing.rows[0];
        if(order)return{orderId:order.id,orderNumber:order.order_number,totalMinor:Number(order.total_minor),paymentMethod:order.payment_method,paymentDetails:order.payment_snapshot,receiptToken:receiptToken(order.id)};
      }
    }
    const paymentDetails=currentPaymentSettings;
    if(paymentDetails && !paymentDetails.raastEnabled)throw new CheckoutError("PAYMENT_UNAVAILABLE","Raast is not available. Choose cash on delivery.",409);
    const resolved: Array<CheckoutProduct & {quantity:number;unitPriceMinor:number;lineTotalMinor:number;deliveryChargeMinor:number}> = [];
    const allocations: Array<{variantId:string;warehouseId:string;quantity:number}>=[];
    for(const line of lines){
      const product=await client.query<CheckoutProduct>(`SELECT p.id,p.title,v.id AS variant_id,v.sku,v.price_minor,v.currency,to_jsonb(v)->>'delivery_charge_minor' AS delivery_charge_minor FROM products p JOIN categories c ON c.id=p.category_id JOIN LATERAL (SELECT * FROM product_variants WHERE product_id=p.id AND active=true ORDER BY created_at,id LIMIT 1) v ON true WHERE p.id=$1 AND p.status='published' AND c.is_active=true FOR SHARE OF p,c`,[line.productId]);
      const item=product.rows[0];
      if(!item)throw new CheckoutError("PRODUCT_UNAVAILABLE","A product in your cart is no longer available.",409);
      await client.query("SELECT id FROM product_variants WHERE id=$1 FOR UPDATE",[item.variant_id]);
      const stock=await client.query<{warehouse_id:string;on_hand:number;reserved:number}>("SELECT warehouse_id,on_hand,reserved FROM inventory_stock WHERE variant_id=$1 ORDER BY warehouse_id FOR UPDATE",[item.variant_id]);
      if(stock.rows.reduce((sum,row)=>sum+row.on_hand-row.reserved,0)<line.quantity)throw new CheckoutError("INSUFFICIENT_STOCK",`${item.title} no longer has enough stock. Update your cart.`,409);
      let remaining=line.quantity;
      for(const row of stock.rows){
        const quantity=Math.min(remaining,row.on_hand-row.reserved);
        if(quantity>0){await client.query("UPDATE inventory_stock SET reserved=reserved+$3 WHERE variant_id=$1 AND warehouse_id=$2",[item.variant_id,row.warehouse_id,quantity]);allocations.push({variantId:item.variant_id,warehouseId:row.warehouse_id,quantity});remaining-=quantity;}
        if(!remaining)break;
      }
      if(item.currency!=="PKR")throw new CheckoutError("INVALID_CURRENCY","This product cannot be checked out in PKR.",409);
      resolved.push({...item,quantity:line.quantity,unitPriceMinor:Number(item.price_minor),lineTotalMinor:Number(item.price_minor)*line.quantity,deliveryChargeMinor:Number(item.delivery_charge_minor ?? DEFAULT_DELIVERY_CHARGE_MINOR)});
    }
    const subtotalMinor=resolved.reduce((sum,line)=>sum+line.lineTotalMinor,0),shipping=shippingMinor(resolved),totalMinor=subtotalMinor+shipping;
    if(expectedTotalMinor!==undefined&&expectedTotalMinor!==totalMinor)throw new CheckoutError("PRICE_CHANGED","A price or delivery charge changed. Refresh the cart totals before placing your order.",409);
    const orderNumber=`NS-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const shippingSnapshot={name:`${delivery.firstName} ${delivery.lastName}`,phone:delivery.phone,street:delivery.street,city:delivery.city,postalCode:delivery.postalCode};
    const order=await client.query<{id:string}>(`INSERT INTO orders(order_number,user_id,email_normalized,order_status,payment_status,fulfillment_status,payment_method,currency,subtotal_minor,shipping_minor,tax_minor,total_minor,shipping_snapshot) VALUES($1,$2,$3,'pending',$4,'unfulfilled',$5,'PKR',$6,$7,0,$8,$9) RETURNING id`,[orderNumber,userId,delivery.email,paymentMethod==="raast"?"pending":"unpaid",paymentMethod,subtotalMinor,shipping,totalMinor,JSON.stringify(shippingSnapshot)]);
    const orderId=order.rows[0].id;
    if(paymentDetails)await client.query("UPDATE orders SET payment_snapshot=$2 WHERE id=$1",[orderId,JSON.stringify(paymentDetails)]);
    for(const item of resolved)await client.query("INSERT INTO order_items(order_id,variant_id,sku_snapshot,title_snapshot,quantity,unit_price_minor,line_total_minor) VALUES($1,$2,$3,$4,$5,$6,$7)",[orderId,item.variant_id,item.sku,item.title,item.quantity,item.unitPriceMinor,item.lineTotalMinor]);
    for(const allocation of allocations)await client.query("INSERT INTO order_stock(order_id,variant_id,warehouse_id,quantity) VALUES($1,$2,$3,$4)",[orderId,allocation.variantId,allocation.warehouseId,allocation.quantity]);
    await client.query("INSERT INTO outbox_events(type,aggregate_id,aggregate_version,payload) VALUES('order.created',$1,1,$2)",[orderId,JSON.stringify({orderNumber,paymentMethod,totalMinor})]);
    await client.query("INSERT INTO idempotency_keys(scope,actor_key,key,request_hash,response_ref,expires_at) VALUES('checkout',$1,$2,$3,$4,now()+interval '24 hours') ON CONFLICT(scope,actor_key,key) DO UPDATE SET response_ref=EXCLUDED.response_ref",[delivery.email,idempotencyKey,requestHash,orderId]);
    return {orderId,orderNumber,totalMinor,paymentMethod,paymentDetails,receiptToken:receiptToken(orderId)};
  });
}
