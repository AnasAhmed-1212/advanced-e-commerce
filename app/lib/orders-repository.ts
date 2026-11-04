import "server-only";
import { query, withTransaction } from "./db";
import { CommerceError } from "./api-errors";
export type AdminOrder={id:string;orderNumber:string;email:string;orderStatus:string;paymentStatus:string;paymentMethod:string;paymentReference:string|null;fulfillmentStatus:string;currency:string;subtotalMinor:number;shippingMinor:number;taxMinor:number;totalMinor:number;createdAt:string;itemCount:number};
type OrderRow={id:string;order_number:string;email_normalized:string;order_status:string;payment_status:string;payment_method:string;payment_reference:string|null;fulfillment_status:string;currency:string;subtotal_minor:string;shipping_minor:string;tax_minor:string;total_minor:string;created_at:Date;item_count:number};
const select=`SELECT o.id,o.order_number,o.email_normalized,o.order_status,o.payment_status,o.payment_method,o.payment_reference,o.fulfillment_status,o.currency,o.subtotal_minor,o.shipping_minor,o.tax_minor,o.total_minor,o.created_at,COALESCE(SUM(i.quantity),0)::int AS item_count FROM orders o LEFT JOIN order_items i ON i.order_id=o.id`;
function dto(r:OrderRow):AdminOrder{return{id:r.id,orderNumber:r.order_number,email:r.email_normalized,orderStatus:r.order_status,paymentStatus:r.payment_status,paymentMethod:r.payment_method,paymentReference:r.payment_reference,fulfillmentStatus:r.fulfillment_status,currency:r.currency,subtotalMinor:Number(r.subtotal_minor),shippingMinor:Number(r.shipping_minor),taxMinor:Number(r.tax_minor),totalMinor:Number(r.total_minor),createdAt:r.created_at.toISOString(),itemCount:r.item_count};}
export async function listAdminOrders(){return(await query<OrderRow>(`${select} GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`)).rows.map(dto);}
export async function getAdminOrder(id:string){
  const result=await query<OrderRow>(`${select} WHERE o.id=$1 GROUP BY o.id`,[id]);if(!result.rows[0])return null;
  const items=await query<{id:string;title_snapshot:string;quantity:number;unit_price_minor:string;line_total_minor:string}>("SELECT id,title_snapshot,quantity,unit_price_minor,line_total_minor FROM order_items WHERE order_id=$1 ORDER BY id",[id]);
  const shipping=await query<{shipping_snapshot:Record<string,string>}>("SELECT shipping_snapshot FROM orders WHERE id=$1",[id]);
  return{...dto(result.rows[0]),items:items.rows.map(i=>({id:i.id,title:i.title_snapshot,quantity:i.quantity,unitPriceMinor:Number(i.unit_price_minor),lineTotalMinor:Number(i.line_total_minor)})),shipping:shipping.rows[0]?.shipping_snapshot??{}};
}
export async function updateAdminOrder(id:string,input:{orderStatus?:string;paymentStatus?:string;fulfillmentStatus?:string}){
  return withTransaction(async client=>{
    const result=await client.query<{order_status:string;fulfillment_status:string;inventory_status:string}>("SELECT order_status,fulfillment_status,inventory_status FROM orders WHERE id=$1 FOR UPDATE",[id]);
    const current=result.rows[0];if(!current)return false;
    const orderStatus=input.orderStatus||current.order_status,fulfillment=input.fulfillmentStatus||current.fulfillment_status;
    const releasing=orderStatus==="cancelled"||fulfillment==="returned",fulfilling=orderStatus==="completed"||fulfillment==="delivered";
    if(current.inventory_status==="released"&&!releasing)throw new CommerceError("A cancelled or returned order cannot be reopened. Create a new order.",409);
    if(releasing&&fulfilling&&fulfillment!=="returned")throw new CommerceError("An order cannot be delivered and cancelled at the same time.",409);
    if(current.inventory_status==="fulfilled"&&orderStatus==="cancelled"&&fulfillment!=="returned")throw new CommerceError("This order has been delivered. Mark it returned to restore stock.",409);
    const nextInventory=releasing?"released":fulfilling?"fulfilled":current.inventory_status;
    if(nextInventory!==current.inventory_status){
      const allocations=await client.query<{variant_id:string;warehouse_id:string;quantity:number}>("SELECT variant_id,warehouse_id,quantity FROM order_stock WHERE order_id=$1 ORDER BY variant_id,warehouse_id",[id]);
      for(const item of allocations.rows){
        if(current.inventory_status==="reserved")await client.query("UPDATE inventory_stock SET reserved=reserved-$3,on_hand=on_hand-$4 WHERE variant_id=$1 AND warehouse_id=$2",[item.variant_id,item.warehouse_id,item.quantity,nextInventory==="fulfilled"?item.quantity:0]);
        else if(current.inventory_status==="fulfilled"&&nextInventory==="released")await client.query("UPDATE inventory_stock SET on_hand=on_hand+$3 WHERE variant_id=$1 AND warehouse_id=$2",[item.variant_id,item.warehouse_id,item.quantity]);
      }
    }
    await client.query("UPDATE orders SET order_status=$2,payment_status=COALESCE($3,payment_status),fulfillment_status=$4,inventory_status=$5 WHERE id=$1",[id,orderStatus,input.paymentStatus??null,fulfillment,nextInventory]);
    return true;
  });
}
