"use client";
import { useState } from "react";
import Link from "next/link";
import { useCart } from "../../cart-context";

export default function ProductActions({ productId }: { productId: number }) {
  const [quantity, setQuantity] = useState(1); const [added, setAdded] = useState(false); const { addItem } = useCart();
  return <div className="product-actions"><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">−</button><span aria-live="polite">{quantity}</span><button onClick={() => setQuantity(quantity + 1)} aria-label="Increase quantity">+</button></div><button className="primary-button buy-button" onClick={() => { addItem(productId, quantity); setAdded(true); }}>{added ? "Added to cart" : "Add to cart"}</button>{added && <Link className="checkout-link" href="/checkout">Continue to checkout →</Link>}</div>;
}
