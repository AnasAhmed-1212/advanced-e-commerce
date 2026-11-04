"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { UUID_PATTERN, type ShopProduct } from "./lib/catalog-types";
type CartLine={productId:string;quantity:number};
type CartContextValue={lines:CartLine[];products:ShopProduct[];itemCount:number;subtotal:number;hydrated:boolean;catalogLoading:boolean;catalogError:string;addItem:(id:string,quantity?:number)=>void;updateQuantity:(id:string,quantity:number)=>void;removeItem:(id:string)=>void;clearCart:()=>void;refreshCatalog:()=>Promise<void>};
const CartContext=createContext<CartContextValue|null>(null),STORAGE_KEY="northstar-cart-v2";
export function CartProvider({children}:{children:React.ReactNode}){
  const[lines,setLines]=useState<CartLine[]>([]),[hydrated,setHydrated]=useState(false),[products,setProducts]=useState<ShopProduct[]>([]),[catalogLoading,setCatalogLoading]=useState(true),[catalogError,setCatalogError]=useState("");
  async function refreshCatalog(){try{const r=await fetch("/api/v1/catalog",{cache:"no-store"}),data=await r.json();if(!r.ok)throw new Error(data.error);setProducts(data.products);setCatalogError("");}catch(reason){setCatalogError(reason instanceof Error?reason.message:"Unable to refresh products.");}finally{setCatalogLoading(false);}}
  useEffect(()=>{
    try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");if(Array.isArray(saved)){const seen=new Set<string>();setLines(saved.filter(line=>{if(!line||typeof line.productId!=="string"||!UUID_PATTERN.test(line.productId)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>20||seen.has(line.productId))return false;seen.add(line.productId);return true;}).slice(0,50));}}catch{}
    setHydrated(true);void refreshCatalog();const refresh=()=>void refreshCatalog();window.addEventListener("focus",refresh);return()=>window.removeEventListener("focus",refresh);
  },[]);
  useEffect(()=>{if(hydrated)try{localStorage.setItem(STORAGE_KEY,JSON.stringify(lines));}catch{}},[lines,hydrated]);
  const value=useMemo<CartContextValue>(()=>({lines,products,hydrated,catalogLoading,catalogError,itemCount:lines.reduce((sum,line)=>sum+line.quantity,0),subtotal:lines.reduce((sum,line)=>sum+(products.find(p=>p.id===line.productId)?.price||0)*line.quantity,0),
    addItem:(id,quantity=1)=>setLines(current=>{if(!UUID_PATTERN.test(id)||!Number.isInteger(quantity)||quantity<1)return current;const product=products.find(p=>p.id===id),max=Math.min(20,product?.available??20);if(max<1)return current;return current.some(l=>l.productId===id)?current.map(l=>l.productId===id?{...l,quantity:Math.min(max,l.quantity+quantity)}:l):current.length>=50?current:[...current,{productId:id,quantity:Math.min(max,quantity)}];}),
    updateQuantity:(id,quantity)=>setLines(current=>!Number.isInteger(quantity)?current:quantity<1?current.filter(l=>l.productId!==id):current.map(l=>l.productId===id?{...l,quantity:Math.min(20,quantity)}:l)),removeItem:id=>setLines(current=>current.filter(l=>l.productId!==id)),clearCart:()=>setLines([]),refreshCatalog}),[lines,products,hydrated,catalogLoading,catalogError]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart(){const value=useContext(CartContext);if(!value)throw new Error("useCart must be used inside CartProvider");return value;}
