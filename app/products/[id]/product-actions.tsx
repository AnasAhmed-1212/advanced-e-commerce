"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "../../cart-context";
import { useFavorites } from "../../use-favorites";
import type { ShopProduct } from "../../lib/catalog-types";
import styles from "./product-detail.module.css";

export default function ProductActions({product}:{product:ShopProduct}){
  const[quantity,setQuantity]=useState(1),[added,setAdded]=useState(false);
  const{addItem,lines,products,catalogLoading,catalogError,refreshCatalog}=useCart(),{favorites,toggleSaved}=useFavorites(),router=useRouter();
  const live=products.find(item=>item.id===product.id)||product,existing=lines.find(line=>line.productId===product.id)?.quantity||0,room=Math.max(0,Math.min(20,live.available)-existing),saved=favorites.includes(product.id);
  useEffect(()=>{setQuantity(current=>Math.max(1,Math.min(current,room)));},[room]);
  const cartFull=!existing&&lines.length>=50,disabled=!room||cartFull||catalogLoading||Boolean(catalogError);
  function add(buyNow:boolean){if(disabled)return;addItem(product.id,Math.min(quantity,room));setAdded(true);if(buyNow)router.push("/checkout");}
  const enquiry=`Assalam-o-Alaikum, I would like to make an offer or ask about ${product.name} (quantity ${quantity}). Please confirm the details and price.`;
  return <div className={styles.actions}>
    <div className={styles.quantityRow}><label htmlFor="product-quantity">Quantity</label><div className={styles.quantity}><button type="button" aria-label="Decrease quantity" disabled={quantity<=1||disabled} onClick={()=>setQuantity(value=>value-1)}><Minus size={13}/></button><input id="product-quantity" type="number" inputMode="numeric" min={1} max={Math.max(1,room)} disabled={disabled} value={quantity} onChange={event=>setQuantity(Math.max(1,Math.min(room,Number(event.target.value)||1)))}/><button type="button" aria-label="Increase quantity" disabled={quantity>=room||disabled} onClick={()=>setQuantity(value=>value+1)}><Plus size={13}/></button></div><span>{live.available?`${live.available} available`:"Out of stock"}</span></div>
    {existing>0&&<p className={styles.cartNote}>{existing} already in your cart{!room?" · Cart limit reached":""}.</p>}
    {catalogError&&<p className={styles.actionError}>Unable to check current stock. <button type="button" onClick={()=>void refreshCatalog()}>Try again</button></p>}
    <button type="button" className={styles.buyNow} disabled={disabled} onClick={()=>add(true)}>{!live.available?"Out of stock":catalogLoading?"Checking availability…":cartFull?"Cart is full":!room?"Cart limit reached":"Buy now"}</button>
    <button type="button" className={styles.outlineButton} disabled={disabled} onClick={()=>add(false)}><ShoppingBag size={16}/>{added?"Added to cart ✓":"Add to cart"}</button>
    <a className={styles.outlineButton} href={`https://wa.me/923310170118?text=${encodeURIComponent(enquiry)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/>Make an offer / Enquire</a>
    <button type="button" className={`${styles.outlineButton} ${saved?styles.saved:""}`} aria-pressed={saved} onClick={()=>toggleSaved(product.id)}><Heart size={16} fill={saved?"currentColor":"none"}/>{saved?"Remove from wishlist":"Add to wishlist"}</button>
    {added&&<Link className={styles.checkoutLink} href="/checkout">Continue to checkout →</Link>}
    <span className={styles.srOnly} role="status">{added?"Product added to your cart.":""}</span>
  </div>;
}
