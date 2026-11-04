import { getAdminSession } from "../../../../lib/admin-session";
import { query } from "../../../../lib/db";
import { apiError } from "../../../../lib/api-errors";
export async function GET(){
  if(!(await getAdminSession()))return Response.json({error:"Unauthorized"},{status:401});
  try{const result=await query<{products:number;categories:number;orders:number;revenue:string;pending_payments:number}>(`SELECT (SELECT count(*)::int FROM products) AS products,(SELECT count(*)::int FROM categories) AS categories,(SELECT count(*)::int FROM orders) AS orders,(SELECT COALESCE(sum(total_minor),0)::text FROM orders WHERE payment_status='paid' AND order_status!='cancelled') AS revenue,(SELECT count(*)::int FROM orders WHERE payment_method='raast' AND payment_status='pending' AND order_status!='cancelled') AS pending_payments`);return Response.json(result.rows[0]);}catch(error){return apiError(error);}
}
