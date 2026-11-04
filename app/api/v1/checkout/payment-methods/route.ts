import { getPaymentSettings } from "../../../../lib/payment-settings";
import { connection } from "next/server";
export async function GET() {
  await connection();
  try {
    const settings=await getPaymentSettings();
    return Response.json({cod:true,raast:settings.raastEnabled?settings:null},{headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({error:"Unable to load payment methods."},{status:503}); }
}
