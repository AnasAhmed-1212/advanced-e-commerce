import "server-only";
import { query } from "./db";
import { hashCustomerPassword,verifyCustomerPassword } from "./customer-auth";
type UserRow={id:string;email_normalized:string;password_hash:string;first_name:string;last_name:string;phone:string|null;status:string};
export async function createCustomer(input:{email:string;password:string;firstName:string;lastName:string}){const hash=await hashCustomerPassword(input.password);const result=await query<UserRow>(`INSERT INTO users (email_normalized,password_hash,first_name,last_name) VALUES ($1,$2,$3,$4) RETURNING *`,[input.email,hash,input.firstName,input.lastName]);return result.rows[0]}
export async function authenticateCustomer(email:string,password:string){const result=await query<UserRow>(`SELECT * FROM users WHERE email_normalized=$1 AND status='active'`,[email]);const user=result.rows[0];return user&&await verifyCustomerPassword(password,user.password_hash)?user:null}
export async function getCustomerAccount(id:string){const user=await query<UserRow>(`SELECT * FROM users WHERE id=$1 AND status='active'`,[id]);if(!user.rows[0])return null;const orders=await query<{id:string;order_number:string;order_status:string;payment_status:string;fulfillment_status:string;total_minor:string;currency:string;created_at:Date}>(`SELECT id,order_number,order_status,payment_status,fulfillment_status,total_minor,currency,created_at FROM orders WHERE user_id=$1 OR (user_id IS NULL AND email_normalized=$2) ORDER BY created_at DESC LIMIT 50`,[id,user.rows[0].email_normalized]);return{user:{id:user.rows[0].id,email:user.rows[0].email_normalized,firstName:user.rows[0].first_name,lastName:user.rows[0].last_name,phone:user.rows[0].phone},orders:orders.rows.map(o=>({id:o.id,orderNumber:o.order_number,orderStatus:o.order_status,paymentStatus:o.payment_status,fulfillmentStatus:o.fulfillment_status,totalMinor:Number(o.total_minor),currency:o.currency,createdAt:o.created_at.toISOString()}))}}

export async function listCustomers(page: number) {
  const pageSize = 50;
  const { rows } = await query<{
    id: string; email_normalized: string; first_name: string; last_name: string;
    status: string; created_at: Date;
  }>(`SELECT id,email_normalized,first_name,last_name,status,created_at
    FROM users ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2`, [pageSize + 1, (page - 1) * pageSize]);
  return {
    hasMore: rows.length > pageSize,
    customers: rows.slice(0, pageSize).map(row => ({
      id: row.id, email: row.email_normalized, firstName: row.first_name,
      lastName: row.last_name, status: row.status, createdAt: row.created_at.toISOString(),
    })),
  };
}
