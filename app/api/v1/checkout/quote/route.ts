import { products } from "../../../../catalog";

type QuoteRequest = { items?: Array<{ productId?: unknown; quantity?: unknown }> };

export async function POST(request: Request) {
  let body: QuoteRequest;
  try { body = await request.json() as QuoteRequest; } catch { return Response.json({ code: "INVALID_JSON", message: "Request body must be valid JSON." }, { status: 400 }); }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) return Response.json({ code: "INVALID_CART", message: "Cart must contain between 1 and 50 items." }, { status: 400 });
  const seen = new Set<number>(); const lines = [];
  for (const raw of body.items) {
    const productId = Number(raw.productId); const quantity = Number(raw.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || seen.has(productId)) return Response.json({ code: "INVALID_ITEM", message: "Each product must be unique with a quantity from 1 to 20." }, { status: 400 });
    const product = products.find((item) => item.id === productId); if (!product) return Response.json({ code: "PRODUCT_UNAVAILABLE", message: `Product ${productId} is unavailable.` }, { status: 409 });
    seen.add(productId); lines.push({ productId, name: product.name, unitPriceMinor: product.price, quantity, lineTotalMinor: product.price * quantity, currency: "PKR" });
  }
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0); const shippingMinor = subtotalMinor >= 15000 ? 0 : 650;
  return Response.json({ quoteId: crypto.randomUUID(), currency: "PKR", lines, subtotalMinor, shippingMinor, taxMinor: 0, totalMinor: subtotalMinor + shippingMinor, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
}
