import { createCheckoutOrder, type Delivery } from "../../../../lib/checkout-orders";
import { cartLines } from "../../../../lib/checkout-validation";
import { getCustomerSession } from "../../../../lib/customer-auth";
import { apiError, checkOrigin, CommerceError, readJson } from "../../../../lib/api-errors";
import { UUID_PATTERN } from "../../../../lib/catalog-types";
export async function POST(request:Request){
  try{
    checkOrigin(request);
    const key=request.headers.get("idempotency-key");
    if(!key || !UUID_PATTERN.test(key))throw new CommerceError("A valid checkout key is required.");
    const body=await readJson(request),items=cartLines(body.items);
    const source=body.delivery&&typeof body.delivery==="object"?body.delivery as Record<string,unknown>:{};
    const value=(key:keyof Delivery,max:number)=>typeof source[key]==="string"?(source[key] as string).trim().slice(0,max):"";
    const delivery:Delivery={email:value("email",254).toLowerCase(),phone:value("phone",30),firstName:value("firstName",80),lastName:value("lastName",80),street:value("street",200),city:value("city",100),postalCode:value("postalCode",20)};
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(delivery.email)||!delivery.phone||!delivery.firstName||!delivery.lastName||!delivery.street||!delivery.city)throw new CommerceError("Please complete all required delivery details.");
    if(body.paymentMethod!=="cod"&&body.paymentMethod!=="raast")throw new CommerceError("Choose a valid payment method.");
    if(typeof body.expectedTotalMinor!=="number"||!Number.isSafeInteger(body.expectedTotalMinor)||body.expectedTotalMinor<0)throw new CommerceError("Refresh your cart totals before ordering.");
    const session=await getCustomerSession();
    const userId=session&&session.email===delivery.email?session.userId:null;
    return Response.json(await createCheckoutOrder(items,delivery,key,body.paymentMethod,userId,body.expectedTotalMinor),{status:201});
  }catch(error){return apiError(error);}
}
