import { validReceiptToken } from "../../../../../../lib/order-receipt";
import { query } from "../../../../../../lib/db";
import { UUID_PATTERN } from "../../../../../../lib/catalog-types";
import { apiError, checkOrigin, CommerceError, readJson } from "../../../../../../lib/api-errors";
export async function POST(request: Request,{params}:{params:Promise<{id:string}>}) {
  try {
    checkOrigin(request); const {id}=await params; const body=await readJson(request);
    if (!UUID_PATTERN.test(id) || !validReceiptToken(id,body.token)) throw new CommerceError("Invalid order access.",403);
    const reference=typeof body.reference==="string"?body.reference.trim():"";
    if (reference.length<4 || reference.length>120) throw new CommerceError("Enter a transfer reference between 4 and 120 characters.");
    const result=await query("UPDATE orders SET payment_reference=$2 WHERE id=$1 AND payment_method='raast' AND payment_status='pending' AND order_status!='cancelled' RETURNING id",[id,reference]);
    if (!result.rowCount) throw new CommerceError("This order is no longer awaiting a Raast transfer.",409);
    return Response.json({submitted:true});
  } catch(error) { return apiError(error); }
}
