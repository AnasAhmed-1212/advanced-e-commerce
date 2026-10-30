"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { products } from "./catalog";
type CartLine = { productId: number; quantity: number };
type CartContextValue = { lines: CartLine[]; itemCount: number; subtotal: number; hydrated: boolean; addItem: (productId: number, quantity?: number) => void; updateQuantity: (productId: number, quantity: number) => void; removeItem: (productId: number) => void; clearCart: () => void };
const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "northstar-cart-v1";
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]); const [hydrated, setHydrated] = useState(false);
  useEffect(() => { queueMicrotask(() => { try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setLines(JSON.parse(saved)); } catch {} setHydrated(true); }); }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); }, [lines, hydrated]);
  const value = useMemo<CartContextValue>(() => ({ lines, hydrated, itemCount: lines.reduce((sum, line) => sum + line.quantity, 0), subtotal: lines.reduce((sum, line) => sum + (products.find((p) => p.id === line.productId)?.price ?? 0) * line.quantity, 0), addItem: (productId, quantity = 1) => setLines((current) => current.some((line) => line.productId === productId) ? current.map((line) => line.productId === productId ? { ...line, quantity: line.quantity + quantity } : line) : [...current, { productId, quantity }]), updateQuantity: (productId, quantity) => setLines((current) => quantity < 1 ? current.filter((line) => line.productId !== productId) : current.map((line) => line.productId === productId ? { ...line, quantity } : line)), removeItem: (productId) => setLines((current) => current.filter((line) => line.productId !== productId)), clearCart: () => setLines([]) }), [lines, hydrated]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() { const value = useContext(CartContext); if (!value) throw new Error("useCart must be used inside CartProvider"); return value; }
