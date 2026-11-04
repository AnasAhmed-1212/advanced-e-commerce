import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
export function receiptToken(orderId:string) {
  const secret=process.env.CUSTOMER_SESSION_SECRET||process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length<32) throw new Error("ORDER_RECEIPT_SECRET_MISSING");
  return createHmac("sha256",secret).update(`order-payment-reference:${orderId}`).digest("hex");
}
export function validReceiptToken(orderId:string,token:unknown) {
  if (typeof token!=="string" || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(receiptToken(orderId),"hex"),Buffer.from(token,"hex"));
}
