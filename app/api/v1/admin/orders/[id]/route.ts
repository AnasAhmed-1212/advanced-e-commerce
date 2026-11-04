import { getAdminSession } from "../../../../../lib/admin-session";
import { getAdminOrder,updateAdminOrder } from "../../../../../lib/orders-repository";
import { apiError, checkOrigin, CommerceError, readJson } from "../../../../../lib/api-errors";
import { UUID_PATTERN } from "../../../../../lib/catalog-types";
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Context){
  if(!(await getAdminSession()))return Response.json({error:"Unauthorized"},{status:401});
  try{const{id}=await params;if(!UUID_PATTERN.test(id))throw new CommerceError("Invalid order ID");const order=await getAdminOrder(id);if(!order)throw new CommerceError("Order not found",404);return Response.json({order});}catch(error){return apiError(error);}
}
export async function PATCH(request:Request,{params}:Context){
  if(!(await getAdminSession()))return Response.json({error:"Unauthorized"},{status:401});
  try{
    checkOrigin(request);const{id}=await params;if(!UUID_PATTERN.test(id))throw new CommerceError("Invalid order ID");const body=await readJson(request);
    const allowed={orderStatus:["pending","confirmed","cancelled","completed"],paymentStatus:["unpaid","pending","paid","refunded","failed"],fulfillmentStatus:["unfulfilled","processing","packed","shipped","delivered","returned"]};
    const input:{orderStatus?:string;paymentStatus?:string;fulfillmentStatus?:string}={};
    for(const key of Object.keys(allowed) as Array<keyof typeof allowed>){if(body[key]!==undefined){if(typeof body[key]!=="string"||!allowed[key].includes(body[key] as string))throw new CommerceError("Invalid status.");input[key]=body[key] as string;}}
    if(!Object.keys(input).length)throw new CommerceError("No status supplied.");
    if(!await updateAdminOrder(id,input))throw new CommerceError("Order not found",404);
    return Response.json({order:await getAdminOrder(id)});
  }catch(error){return apiError(error);}
}
