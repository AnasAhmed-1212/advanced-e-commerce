"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useFavorites } from "./use-favorites";
import { useCart } from "./cart-context";
import { UUID_PATTERN, type ShopProduct } from "./lib/catalog-types";
import ProductCard from "./product-card";
import styles from "./product-ui.module.css";

export function ProductShelf({ title,products }: { title: string; products: ShopProduct[] }) {
  const rail = useRef<HTMLDivElement>(null), { favorites,toggleSaved } = useFavorites();
  if (!products.length) return null;
  return <section className={styles.shelf} aria-label={title}><div className={styles.shelfHeading}><div><span>DISCOVER MORE</span><h2>{title}</h2></div><div><button type="button" aria-label={`Previous ${title.toLowerCase()}`} onClick={() => rail.current?.scrollBy({left: -rail.current.clientWidth*.85,behavior:"smooth"})}><ArrowLeft size={18}/></button><button type="button" aria-label={`Next ${title.toLowerCase()}`} onClick={() => rail.current?.scrollBy({left: rail.current.clientWidth*.85,behavior:"smooth"})}><ArrowRight size={18}/></button></div></div><div ref={rail} className={styles.productRail}>{products.map(product => <ProductCard key={product.id} product={product} saved={favorites.includes(product.id)} onSave={() => toggleSaved(product.id)}/>)}</div></section>;
}

export function RecentlyViewed({ productId }: { productId: string }) {
  const [ids,setIds] = useState<string[]>([]), { products } = useCart();
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("northstar-recently-viewed") || "[]");
      const previous: string[] = Array.isArray(stored) ? [...new Set(stored.filter((id: unknown): id is string => typeof id === "string" && UUID_PATTERN.test(id) && id !== productId))].slice(0,11) : [];
      setIds(previous); localStorage.setItem("northstar-recently-viewed",JSON.stringify([productId,...previous]));
    } catch {}
  },[productId]);
  return <ProductShelf title="Recently viewed" products={ids.flatMap(id => { const item = products.find(product => product.id === id); return item ? [item] : []; })}/>;
}
