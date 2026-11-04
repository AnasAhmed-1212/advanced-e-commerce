import { listShopProducts } from "../../../../lib/products-repository";
import { apiError, readJson, CommerceError } from "../../../../lib/api-errors";
import { cartLines, shippingMinor } from "../../../../lib/checkout-validation";
export async function POST(request:Request){
  try {
    const lines=cartLines((await readJson(request)).items);
    const catalog=await listShopProducts();
    const quoted=lines.map(line=>{
      const product=catalog.find(item=>item.id===line.productId);
      if(!product)throw new CommerceError("A product in your cart is no longer available.",409);
      if(product.available<line.quantity)throw new CommerceError(`${product.name} does not have enough stock.`,409);
      return {...line,name:product.name,unitPriceMinor:product.priceMinor,lineTotalMinor:product.priceMinor*line.quantity};
    });
    const subtotalMinor=quoted.reduce((sum,line)=>sum+line.lineTotalMinor,0),shipping=shippingMinor(subtotalMinor);
    return Response.json({currency:"PKR",lines:quoted,subtotalMinor,shippingMinor:shipping,totalMinor:subtotalMinor+shipping,taxMinor:0});
  }catch(error){return apiError(error);}
}
