import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { money, products } from "../../catalog";
import { ProductArt } from "../../storefront";
import ProductActions from "./product-actions";

export function generateStaticParams() { return products.map((product) => ({ id: String(product.id) })); }
export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params; const product = products.find((item) => item.id === Number(id));
  return product ? { title: `${product.name} — Northstar`, description: `Shop ${product.name} with secure checkout and easy returns.` } : {};
}
export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params; const product = products.find((item) => item.id === Number(id)); if (!product) notFound();
  return <main className="commerce-page"><header className="commerce-header section-shell"><Link className="logo" href="/"><span>N</span> northstar</Link><nav><Link href="/">Shop</Link><Link href="/checkout">Cart & checkout</Link></nav></header><div className="breadcrumb section-shell"><Link href="/">Home</Link><span>/</span><span>{product.category}</span><span>/</span><strong>{product.name}</strong></div><section className="product-detail section-shell"><div className="detail-gallery"><ProductArt product={product}/><div className="gallery-thumbs"><button aria-label="Front view" className="active"><ProductArt product={product}/></button><button aria-label="Detail view"><ProductArt product={{...product, palette:[product.palette[0],"#21322b"]}}/></button></div></div><div className="detail-copy"><span className="eyebrow">{product.category} · In stock</span><h1>{product.name}</h1><div className="detail-rating"><b>★ {product.rating}</b><span>{product.reviews} verified reviews</span></div><div className="detail-price"><strong>{money(product.price)}</strong>{product.compareAt && <del>{money(product.compareAt)}</del>}</div><p>Designed for everyday use with dependable performance, considered materials, and a clean form that fits naturally into your routine.</p><div className="option-block"><strong>Finish</strong><div><button className="swatch active">Signature</button><button className="swatch">Midnight</button></div></div><ProductActions productId={product.id}/><ul className="detail-promises"><li><b>Free delivery</b><span>Estimated 2–4 business days</span></li><li><b>14-day returns</b><span>Simple, tracked return process</span></li><li><b>Secure payment</b><span>Payment details handled by approved providers</span></li></ul></div></section><section className="detail-story section-shell"><div><span className="eyebrow">Why it works</span><h2>Designed around the day you already have.</h2></div><p>Every Northstar product is selected for usability, durability, and visual restraint. Clear specifications, honest availability, and useful support come before hype.</p></section></main>;
}
