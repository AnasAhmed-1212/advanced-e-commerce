import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Banknote, ChevronDown, ChevronRight, CircleHelp, CreditCard, PackageCheck, ShoppingBag, Truck } from "lucide-react";
import { money, productMoney } from "../../catalog";
import { listShopProducts } from "../../lib/products-repository";
import { getPaymentSettings } from "../../lib/payment-settings";
import OfferStrip from "../../offer-strip";
import { ProductShelf, RecentlyViewed } from "../../product-shelf";
import ProductActions from "./product-actions";
import ProductGallery from "./product-gallery";
import styles from "./product-detail.module.css";
import { STORE_INITIAL, STORE_NAME } from "../../lib/brand";

const readCatalog=cache(listShopProducts);
export async function generateMetadata({params}:PageProps<"/products/[id]">):Promise<Metadata>{
  await connection();const{id}=await params,product=(await readCatalog()).find(item=>item.id===id||item.slug===id);
  return product?{title:`${product.name} — ${STORE_NAME}`,description:product.description.slice(0,160),openGraph:{images:product.images[0]?[product.images[0].url]:[]}}:{};
}
export default async function ProductPage({params}:PageProps<"/products/[id]">){
  await connection();const{id}=await params,[catalog,payments]=await Promise.all([readCatalog(),getPaymentSettings()]);
  const product=catalog.find(item=>item.id===id||item.slug===id);if(!product)notFound();
  const related=catalog.filter(item=>item.id!==product.id).sort((a,b)=>Number(b.categoryId===product.categoryId)-Number(a.categoryId===product.categoryId)||Number(b.available>0)-Number(a.available>0)).slice(0,10);
  return <main className={styles.page}><OfferStrip/><div className={styles.shell}>
    <header className={styles.header}><Link className="logo" href="/"><span aria-hidden="true">{STORE_INITIAL}</span>{STORE_NAME}</Link><nav><Link href="/#products">All products</Link><Link href="/account">My orders</Link><Link href="/checkout">Cart &amp; checkout</Link></nav></header>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight size={12}/><span>{product.category}</span><ChevronRight size={12}/><strong>{product.name}</strong></nav>
    <section className={styles.layout} aria-label="Product information">
      <ProductGallery product={product}/>
      <div className={styles.summary}><span className={styles.category}><i/>{product.category}</span><h1>{product.name}</h1>
        <div className={styles.storeIdentity}><span aria-hidden="true">{STORE_INITIAL}</span><div><strong>{STORE_NAME}</strong><small>Medical equipment &amp; everyday care</small></div></div>
        <div className={styles.price}><strong>{productMoney(product.price)}</strong>{product.previousPriceMinor != null && <del aria-label={`Previous price ${productMoney(product.previousPriceMinor/100)}`}>{productMoney(product.previousPriceMinor/100)}</del>}<span>per piece</span></div>
        <p className={styles.stockLine}><i/>{product.available?"In stock · Ready to order":"Currently out of stock"}</p>
        {product.description&&<><p className={styles.shortDescription}>{product.description}</p><a className={styles.readMore} href="#product-description">Read full description<ChevronRight size={12}/></a></>}
        <ProductActions product={product}/>
        <div className={styles.summaryNote}><PackageCheck size={17}/><span>Your price and stock are checked again at checkout. Track placed orders in <Link href="/account">your account</Link>.</span></div>
        <div className={styles.shipping}>
          <details open><summary><Truck size={16}/>Shipping across Pakistan<ChevronDown size={15}/></summary><p><b>{product.deliveryChargeMinor === 0 ? "Free delivery" : `Delivery charge: ${money(product.deliveryChargeMinor/100)}`}</b>.<br/> Contact the store to confirm delivery timing for your location.</p></details>
          <details open><summary><CreditCard size={16}/>Payment options<ChevronDown size={15}/></summary><div className={styles.paymentTags}><span><Banknote size={14}/>Cash on delivery</span>{payments.raastEnabled&&<span><CreditCard size={14}/>Raast bank transfer</span>}</div><p>{payments.raastEnabled?"Raast receiving details appear at checkout. Bank transfers are verified manually by the store.":"Pay the courier when your order arrives."}</p></details>
          <details><summary><CircleHelp size={16}/>Returns, warranty &amp; compatibility<ChevronDown size={15}/></summary><p>Terms and compatibility depend on the exact item. <a href="https://wa.me/923310170118" target="_blank" rel="noopener noreferrer">Ask our store on WhatsApp</a> to confirm the manufacturer's details and applicable terms before ordering.</p></details>
        </div>
      </div>
    </section>
    <div className={styles.below}><ProductShelf title="Similar items" products={related}/><RecentlyViewed productId={product.id}/></div>
    <section className={styles.details} aria-label="About this item"><nav className={styles.detailTabs}><a href="#item-specifics">Item specifics</a><a href="#product-description">Product description</a></nav>
      <div id="item-specifics" className={styles.specifics}><h2>Item specifics</h2><dl>
        <div><dt>Category</dt><dd>{product.category}</dd></div><div><dt>Price</dt><dd>{productMoney(product.price)} / piece</dd></div><div><dt>Availability</dt><dd>{product.available?`${product.available} pieces available`:"Out of stock"}</dd></div><div><dt>Minimum order</dt><dd>1 piece</dd></div><div><dt>Delivery</dt><dd>Across Pakistan</dd></div><div><dt>Payment</dt><dd>Cash on delivery{payments.raastEnabled?" / Raast":""}</dd></div>
      </dl><p>For model-specific features, fit and compatibility, check the description and manufacturer instructions or ask our store.</p></div>
      <div id="product-description" className={styles.description}><h2>Item description from the store</h2><p>{product.description||"Contact our store for the full product specifications and compatibility information."}</p>{product.images.length>0&&<div className={styles.descriptionImages}>{product.images.map((image,i)=><img key={image.id} src={image.url} alt={`${product.name} — product photo ${i+1}`} width={image.width} height={image.height} loading="lazy"/>)}</div>}</div>
    </section>
    <footer className={styles.footer}><span>{STORE_NAME} · Medical equipment for everyday care</span><Link href="/#products"><ShoppingBag size={12} style={{display:"inline",marginRight:5}}/>Continue shopping</Link></footer>
  </div></main>;
}
