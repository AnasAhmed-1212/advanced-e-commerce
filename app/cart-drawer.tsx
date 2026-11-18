"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { money } from "./catalog";
import { useCart } from "./cart-context";
import { shippingMinor } from "./lib/shipping";
import styles from "./cart-drawer.module.css";

export default function CartDrawer() {
  const { cartOpen, closeCart, lines, products, itemCount, subtotal, hydrated, catalogLoading, catalogError, updateQuantity, removeItem } = useCart();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const panel = dialog.current;
    if (cartOpen && panel && !panel.open) panel.showModal();
    if (!cartOpen && panel?.open) panel.close();
  }, [cartOpen]);

  const entries = lines.map(line => ({ ...line, product: products.find(product => product.id === line.productId) }));
  const delivery = shippingMinor(entries.flatMap(({ product }) => product ? [product] : []));
  const ready = hydrated && !catalogLoading && !catalogError && entries.every(({ product, quantity }) => product && product.available >= quantity);

  return <dialog ref={dialog} className={styles.drawer} aria-labelledby="cart-drawer-title"
    onClose={closeCart} onClick={event => { if (event.target === event.currentTarget) closeCart(); }}>
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 id="cart-drawer-title">Your cart <span>({itemCount})</span></h2>
        <button type="button" className={styles.icon} aria-label="Close cart" onClick={closeCart}><X size={22}/></button>
      </header>
      {!hydrated ? <div className={styles.empty} role="status">Loading your cart…</div> : !lines.length ?
        <section className={styles.empty}>
          <span className={styles.emptyIcon}><ShoppingBag size={30}/></span>
          <h3>Your cart is empty</h3>
          <Link href="/#products" className={styles.primary} onClick={closeCart}>Browse products</Link>
        </section> : <>
          <ul className={styles.lines}>
            {entries.map(({ productId, product, quantity }) => {
              const image = product?.images[0];
              const name = product?.name ?? (catalogLoading ? "Loading product…" : "Unavailable product");
              return <li key={productId} className={styles.line}>
                <span className={styles.art}>{image ? <Image src={image.url} alt="" width={72} height={72} unoptimized/> : <ShoppingBag size={22}/>}</span>
                <div className={styles.lineInfo}>
                  {product ? <Link href={"/products/" + product.slug} onClick={closeCart}>{name}</Link> : <strong>{name}</strong>}
                  {product && <small>{money(product.price * quantity)}</small>}
                  {product && product.available < quantity && <small>Only {product.available} in stock</small>}
                  <div className={styles.controls}>
                    <button type="button" aria-label={"Decrease quantity of " + name} onClick={() => updateQuantity(productId, quantity - 1)}><Minus size={15}/></button>
                    <span>{quantity}</span>
                    <button type="button" aria-label={"Increase quantity of " + name} disabled={!product || quantity >= Math.min(20, product.available)} onClick={() => updateQuantity(productId, quantity + 1)}><Plus size={15}/></button>
                    <button type="button" className={styles.remove} aria-label={"Remove " + name} onClick={() => removeItem(productId)}>Remove</button>
                  </div>
                </div>
              </li>;
            })}
          </ul>
          <footer className={styles.footer}>
            {catalogError && <p role="alert">{catalogError}</p>}
            {ready && <><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
              <div><span>Delivery</span><strong>{delivery === 0 ? "Free" : money(delivery/100)}</strong></div></>}
            <Link href="/checkout" className={styles.primary} onClick={closeCart}>Continue to checkout</Link>
          </footer>
        </>}
    </div>
  </dialog>;
}
