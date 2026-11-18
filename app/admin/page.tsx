"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { money } from "../catalog";
import { AdminLogin } from "./admin-login";
import { AdminProducts } from "./admin-products";
import { AdminCategories } from "./admin-categories";
import { AdminOrders } from "./admin-orders";
import { AdminPayments } from "./admin-payments";
import { STORE_INITIAL, STORE_NAME } from "../lib/brand";
type View="Overview"|"Categories"|"Products"|"Orders"|"Payments";
const views:View[]=["Overview","Categories","Products","Orders","Payments"];
export default function AdminPage(){
  const[view,setView]=useState<View>("Overview"),[sidebar,setSidebar]=useState(false),[auth,setAuth]=useState<"checking"|"signed-out"|"signed-in">("checking"),[configured,setConfigured]=useState(true);
  useEffect(()=>{void fetch("/api/v1/admin/auth/session",{cache:"no-store"}).then(r=>r.json()).then(data=>{setConfigured(data.configured);setAuth(data.authenticated?"signed-in":"signed-out");}).catch(()=>setAuth("signed-out"));},[]);
  async function logout(){const r=await fetch("/api/v1/admin/auth/logout",{method:"POST"});if(r.ok)setAuth("signed-out");}
  if(auth==="checking")return <main className="admin-auth-page"><div className="admin-auth-loading"><span aria-hidden="true">{STORE_INITIAL}</span><p>Opening your workspace…</p></div></main>;
  if(auth==="signed-out")return <AdminLogin configured={configured} onSuccess={()=>setAuth("signed-in")}/>;
  return <main className="admin-app"><aside className={`admin-sidebar ${sidebar?"open":""}`}><Link href="/" className="admin-brand"><span aria-hidden="true">{STORE_INITIAL}</span><strong>{STORE_NAME}</strong></Link><nav>{views.map((item,i)=><button key={item} className={view===item?"active":""} onClick={()=>{setView(item);setSidebar(false);}}><span aria-hidden="true">{["◫","▦","□","▤","↗"][i]}</span>{item}</button>)}</nav><div className="admin-side-bottom"><button onClick={()=>void logout()}>Sign out</button><div className="admin-user"><span aria-hidden="true">{STORE_INITIAL}</span><div><strong>Store administrator</strong><small>Products, orders and payments</small></div></div></div></aside><section className="admin-workspace"><header className="admin-topbar"><button className="admin-menu" aria-label="Toggle navigation" onClick={()=>setSidebar(!sidebar)}>☰</button><strong>Store workspace</strong><Link href="/" target="_blank" rel="noreferrer">View store ↗</Link></header><div className="admin-content"><div className="admin-page-title"><div><p>{STORE_NAME}</p><h1>{view}</h1></div></div>{view==="Overview"&&<Overview onNavigate={setView}/>} {view==="Categories"&&<AdminCategories/>} {view==="Products"&&<AdminProducts/>} {view==="Orders"&&<AdminOrders/>} {view==="Payments"&&<AdminPayments/>}</div></section>{sidebar&&<button className="admin-overlay" aria-label="Close navigation" onClick={()=>setSidebar(false)}/>}</main>;
}
function Overview({onNavigate}:{onNavigate:(view:View)=>void}){
  const[summary,setSummary]=useState<{products:number;categories:number;orders:number;revenue:string;pending_payments:number}|null>(null),[error,setError]=useState("");
  useEffect(()=>{void fetch("/api/v1/admin/summary",{cache:"no-store"}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);setSummary(data);}).catch(reason=>setError(reason.message));},[]);
  return <>{error&&<p className="form-error" role="alert">{error}</p>}<div className="metric-grid">{[{label:"Paid sales",value:summary?money(Number(summary.revenue)/100):"…"},{label:"Orders",value:summary?.orders??"…"},{label:"Products",value:summary?.products??"…"},{label:"Categories",value:summary?.categories??"…"}].map(metric=><article key={metric.label} className="metric-card blue"><span>{metric.label}</span><strong>{metric.value}</strong><small>Live store data</small></article>)}</div><section className="admin-card setup-card"><h2>Manage your store</h2><p>Create categories, publish products with images, and manage customer orders from one place.</p><div className="setup-actions"><button className="admin-primary" onClick={()=>onNavigate("Categories")}>Manage categories</button><button className="admin-secondary" onClick={()=>onNavigate("Products")}>Manage products</button><button className="admin-secondary" onClick={()=>onNavigate("Orders")}>Review orders{summary?.pending_payments?` (${summary.pending_payments} Raast payments pending)`:""}</button><button className="admin-secondary" onClick={()=>onNavigate("Payments")}>Configure Raast</button></div></section></>;
}
