"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Heart, Package, ScanSearch, ShoppingBag } from "lucide-react";
import { useCart } from "./cart-context";
import { FREE_DELIVERY_THRESHOLD_MINOR } from "./lib/shipping";
import { money as orderMoney, productMoney as money } from "./catalog";
import type { ShopProduct } from "./lib/catalog-types";
import ImageLightbox from "./image-lightbox";
import styles from "./product-ui.module.css";

export default function ProductCard({ product,saved,onSave }: { product: ShopProduct; saved: boolean; onSave: () => void }) {
  const { addItem,lines,products,catalogLoading,catalogError } = useCart();
  const [viewer,setViewer] = useState(false), [added,setAdded] = useState(false);
  const art = useRef<HTMLDivElement>(null);
  const image = product.images[0], live = products.find(item => item.id === product.id) || product;
  const count = lines.find(line => line.productId === product.id)?.quantity || 0;
  const full = count >= Math.min(20,live.available) || (!count && lines.length >= 50);
  return <article className={`${styles.card} deal-card`}>
    <div ref={art} className={`${styles.cardArt} deal-image`} onPointerMove={event => {
      if (event.pointerType !== "mouse") return;
      const box = event.currentTarget.getBoundingClientRect();
      art.current?.style.setProperty("--zoom-x",`${(event.clientX-box.left)/box.width*100}%`);
      art.current?.style.setProperty("--zoom-y",`${(event.clientY-box.top)/box.height*100}%`);
    }}>
      <Link href={`/products/${product.slug}`} className={styles.imageLink} aria-label={`View ${product.name}`}>
        {image ? <img className={styles.cardImage} src={image.url} alt={product.name} width={image.width} height={image.height} loading="lazy"/> : <span className={styles.placeholder}><Package size={40} strokeWidth={1}/><span>Image coming soon</span></span>}
      </Link>
      <button type="button" className={`${styles.favorite} deal-heart`} onClick={onSave} aria-label={`${saved ? "Unsave" : "Save"} ${product.name}`} aria-pressed={saved}><Heart size={17} fill={saved ? "currentColor" : "none"}/></button>
      {image && <button type="button" className={styles.quickView} aria-label={`Enlarge ${product.name}`} onClick={() => setViewer(true)}><ScanSearch size={18} strokeWidth={1.6}/></button>}
      {!live.available && <span className={styles.soldOut}>Out of stock</span>}
    </div>
    <div className={styles.cardBody}>
      <Link href={`/products/${product.slug}`} className={`${styles.cardName} deal-name`} title={product.name}>{product.name}</Link>
      <strong className={`${styles.cardPrice} deal-price`}>{money(live.price)}</strong>
      {live.previousPriceMinor != null && <del className={styles.previousPrice} aria-label={`Previous price ${money(live.previousPriceMinor/100)}`}>{money(live.previousPriceMinor/100)}</del>}
      <span className={styles.deliveryTag}>Free delivery{live.priceMinor < FREE_DELIVERY_THRESHOLD_MINOR && ` on orders ${orderMoney(FREE_DELIVERY_THRESHOLD_MINOR/100)}+`}</span>
      <p className={styles.cardOrder}>Min. order: <b>1 piece</b></p>
      <p className={styles.cardMeta}><span>{product.category}</span><span className={live.available ? styles.inStock : ""}>{live.available ? "In stock" : "Unavailable"}</span></p>
      <button type="button" className={`${styles.addButton} deal-add`} disabled={!live.available || full || catalogLoading || Boolean(catalogError)} onClick={() => { addItem(product.id); setAdded(true); }}><ShoppingBag size={14}/>{!live.available ? "Out of stock" : catalogLoading ? "Checking stock…" : catalogError ? "Temporarily unavailable" : full ? "Cart limit reached" : added ? "Added to cart ✓" : "Add to cart"}</button>
    </div>
    {viewer && <ImageLightbox name={product.name} images={product.images} onClose={() => setViewer(false)}/>}
  </article>;
}
