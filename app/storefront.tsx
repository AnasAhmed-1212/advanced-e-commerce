"use client";
import { useEffect, useMemo, useState } from "react";
import ProductCard from "./product-card";
import { useFavorites } from "./use-favorites";
import styles from "./product-ui.module.css";
import StoreHeader from "./store-header";
import HeroSlider from "./hero-slider";
import OfferStrip from "./offer-strip";
import Link from "next/link";
import { money } from "./catalog";
import type { ShopProduct, Category } from "./lib/catalog-types";
import { useCart } from "./cart-context";
export function ProductArt({product}:{product:ShopProduct}){
  const image=product.images[0];
  return image?<img className="product-art catalog-product-image" src={image.url} alt={product.name} width={image.width} height={image.height} loading="lazy"/>:<div className="catalog-image-placeholder" aria-label={`No image for ${product.name}`}>{product.name.charAt(0)}</div>;
}
export default function Storefront({products,categories,initialCategory="All"}:{products:ShopProduct[];categories:Category[];initialCategory?:string}){
  const{itemCount}=useCart(),{favorites,toggleSaved}=useFavorites();const[query,setQuery]=useState(""),[activeQuery,setActiveQuery]=useState(""),[category,setCategory]=useState(initialCategory),[savedOnly,setSavedOnly]=useState(false),[sort,setSort]=useState("newest"),[readable,setReadable]=useState(false);
  useEffect(()=>{try{setReadable(localStorage.getItem("northstar-readable-text")==="true");}catch{}},[]);
  const visible=useMemo(()=>{
    const result=products.filter(p=>(category==="All"||p.categoryId===category)&&(!savedOnly||favorites.includes(p.id))&&`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(activeQuery.toLowerCase()));
    if(sort==="price-low")result.sort((a,b)=>a.price-b.price);if(sort==="price-high")result.sort((a,b)=>b.price-a.price);if(sort==="name")result.sort((a,b)=>a.name.localeCompare(b.name));return result;
  },[products,category,savedOnly,favorites,activeQuery,sort]);
  const selectedCategory=categories.find(c=>c.id===category);
  function scroll(){document.querySelector("#products")?.scrollIntoView({behavior:"smooth"});}
  function search(value:string){setQuery(value);setActiveQuery(value.trim());setSavedOnly(false);scroll();}
  function toggleReadable(){setReadable(current=>{const next=!current;try{localStorage.setItem("northstar-readable-text",String(next));}catch{}return next;});}
  function choose(id:string){setCategory(id);setSavedOnly(false);scroll();}
  return <main className="marketplace" data-readable={readable?"true":undefined}><OfferStrip/><StoreHeader categories={categories} category={category} query={query} itemCount={itemCount} favoriteCount={favorites.length} savedOnly={savedOnly} readable={readable} onQueryChange={setQuery} onSearch={search} onCategorySelect={choose} onSavedToggle={()=>{setSavedOnly(current=>!current);scroll();}} onReadableToggle={toggleReadable}/><HeroSlider/>{categories.length>0&&<section className="market-circles"><div className="market-section-title"><h2>Shop by category</h2><button onClick={()=>choose("All")}>See all</button></div><div className="circle-grid">{categories.map(c=><button key={c.id} onClick={()=>choose(c.id)}><span>{c.image?<img src={c.image.url} alt={c.name} width={c.image.width} height={c.image.height} loading="lazy"/>:<b className="category-letter">{c.name.charAt(0)}</b>}</span><b>{c.name}</b><small>{c.productCount} products</small></button>)}</div></section>}<section id="products" className={`${styles.catalog} market-deals`}><div className="market-section-title"><div><h2>{savedOnly?"Your saved items":activeQuery?`Results for “${activeQuery}”`:selectedCategory?.name||"All products"}</h2><p>{selectedCategory?.description||`${visible.length} products · Free delivery on orders of ${money(15000)} or more`}</p></div><select aria-label="Sort products" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></div>{(activeQuery||category!=="All"||savedOnly)&&<button className="clear-catalog-filters" onClick={()=>{setQuery("");setActiveQuery("");setCategory("All");setSavedOnly(false);}}>Clear filters</button>}{visible.length?<div className={`${styles.grid} deal-grid`}>{visible.map(product=><ProductCard key={product.id} product={product} saved={favorites.includes(product.id)} onSave={()=>toggleSaved(product.id)}/>)}</div>:<div className="market-empty"><h3>{products.length?"No matching products":"Our collection is coming soon"}</h3><p>{products.length?"Try another category or search term.":"New products will appear here as soon as they are published."}</p>{products.length>0&&<button onClick={()=>{setActiveQuery("");setQuery("");choose("All");}}>Browse all products</button>}</div>}</section><section className="store-benefits"><div><strong>Delivery across Pakistan</strong><p>Free on orders over {money(15000)}.</p></div><div><strong>Flexible payment</strong><p>Cash on delivery and direct Raast transfers.</p></div><div><strong>Your orders, together</strong><p>Sign in to follow your order history.</p><Link href="/account">My account →</Link></div></section><footer className="market-footer"><div><strong>northstar</strong><p>Thoughtful everyday essentials.</p></div><div><strong>Shop</strong><a href="#products">All products</a><Link href="/checkout">Cart & checkout</Link></div><div><strong>Your account</strong><Link href="/account">Sign in / register</Link><Link href="/account">Order history</Link></div></footer></main>;
}
