import "server-only";
import { query } from "./db";
import { CommerceError } from "./api-errors";
import type { PaymentSettings } from "./catalog-types";
export const defaultPaymentSettings: PaymentSettings = {raastEnabled:false,accountTitle:"",accountNumber:"",bankName:"",instructions:"Use your order number as the payment reference. Your order will be confirmed after we verify receipt."};
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const result=await query<{value:PaymentSettings}>("SELECT value FROM store_settings WHERE key='payments'");
  return {...defaultPaymentSettings,...result.rows[0]?.value};
}
export async function savePaymentSettings(body: Record<string,unknown>) {
  const settings: PaymentSettings={...defaultPaymentSettings};
  if (typeof body.raastEnabled!=="boolean") throw new CommerceError("Choose whether Raast is enabled.");
  settings.raastEnabled=body.raastEnabled;
  for (const key of ["accountTitle","accountNumber","bankName","instructions"] as const) {
    if (typeof body[key]!=="string" || body[key].length>(key==="instructions"?1000:160)) throw new CommerceError("Check the receiving account details.");
    settings[key]=body[key].trim();
  }
  if (settings.raastEnabled && (!settings.accountTitle || !settings.accountNumber || !settings.bankName)) throw new CommerceError("Add the account title, Raast ID or IBAN, and bank before enabling Raast.");
  await query("INSERT INTO store_settings(key,value) VALUES('payments',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()",[JSON.stringify(settings)]);
  return settings;
}
