import { Suspense } from "react";
import { connection } from "next/server";
import Storefront from "./storefront";
import { listShopProducts } from "./lib/products-repository";
import { listCategories } from "./lib/categories-repository";
import { logCatalogFailure } from "./lib/api-errors";
export default function Home(){return <Suspense fallback={<main className="store-loading">Loading the store…</main>}><Catalog/></Suspense>;}
async function Catalog(){
  await connection();
  try{const[products,categories]=await Promise.all([listShopProducts(),listCategories()]);return <Storefront products={products} categories={categories}/>;}
  catch(error){logCatalogFailure(error);return <main className="store-loading"><h1>We’ll be right back.</h1><p>The store is temporarily unavailable. Please refresh in a moment.</p></main>;}
}
