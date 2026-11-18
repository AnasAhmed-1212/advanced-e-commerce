import { UUID_PATTERN } from "./catalog-types";
import { CommerceError } from "./api-errors";
export type CartLine = {productId:string;quantity:number};
export function cartLines(value: unknown): CartLine[] {
  if (!Array.isArray(value) || value.length<1 || value.length>50) throw new CommerceError("Your cart must contain between 1 and 50 products.");
  const seen=new Set<string>();
  return value.map(raw=>{
    if (!raw || typeof raw!=="object" || typeof raw.productId!=="string" || !UUID_PATTERN.test(raw.productId) || !Number.isInteger(raw.quantity) || raw.quantity<1 || raw.quantity>20 || seen.has(raw.productId.toLowerCase())) throw new CommerceError("Each product must be unique, with a quantity from 1 to 20.");
    const productId=raw.productId.toLowerCase(); seen.add(productId);
    return {productId,quantity:raw.quantity as number};
  }).sort((a,b)=>a.productId.localeCompare(b.productId));
}
