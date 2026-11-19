"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { money } from "../catalog";
import { trackStoreActivity } from "../storefront-tracker";
import { useCart } from "../cart-context";
import { useCustomerAccount } from "../customer-account";
import { useFavorites } from "../use-favorites";
import { STORE_INITIAL, STORE_NAME } from "../lib/brand";

const sections = ["Orders", "Profile", "Saved items"] as const;

export default function AccountPage() {
  const { account: data, error: loadError, refresh } = useCustomerAccount();
  const { products, catalogLoading } = useCart();
  const { favorites, toggleSaved } = useFavorites();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [active, setActive] = useState<(typeof sections)[number]>("Orders");
  const [actionError, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const error = actionError || loadError;
  const saved = products.filter(product => favorites.includes(product.id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/account/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Unable to continue.");
      }
      trackStoreActivity(mode === "register" ? "account_registered" : "signed_in");
      setActive("Orders");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/account/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      trackStoreActivity("signed_out");
      await refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <main className="account-loading">{loadError ? <div role="alert">{loadError} <button onClick={() => void refresh()}>Retry</button></div> : "Loading your account..."}</main>;
  if(!data.authenticated)return <main className="account-entry"><section className="account-entry-art"><Link href="/" className="account-logo"><span aria-hidden="true">{STORE_INITIAL}</span>{STORE_NAME}</Link><div><span>MY ACCOUNT</span><h1>More of what you love.</h1><p>Track orders, save time at checkout, and keep everything in one place.</p></div></section><section className="account-entry-form"><div className="account-tabs"><button className={mode==="login"?"active":""} onClick={()=>{setMode("login");setError("")}}>Sign in</button><button className={mode==="register"?"active":""} onClick={()=>{setMode("register");setError("")}}>Create account</button></div><div className="account-form-copy"><span>{mode==="login"?"WELCOME BACK":`JOIN ${STORE_NAME}`}</span><h2>{mode==="login"?"Sign in to your account":"Create your account"}</h2><p>{mode==="login"?`Use the email and password connected to your ${STORE_NAME} account.`:"One account for orders, delivery details, and member benefits."}</p></div>{!data.configured&&<div className="account-setup"><strong>Account setup is pending</strong><p>Connect PostgreSQL, run migration 002, and configure the customer session secret.</p></div>}<form onSubmit={submit}>{mode==="register"&&<div className="account-name-row"><label>First name<input name="firstName" required autoComplete="given-name"/></label><label>Last name<input name="lastName" required autoComplete="family-name"/></label></div>}<label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com"/></label><label>Password<input name="password" type="password" required minLength={mode==="register"?12:1} autoComplete={mode==="register"?"new-password":"current-password"}/></label>{mode==="register"&&<small>At least 12 characters with a letter and number.</small>}{error&&<p className="account-error" role="alert">{error}</p>}<button type="submit" disabled={busy||!data.configured}>{busy?"Please wait…":mode==="login"?"Sign in":"Create account"}</button></form><Link href="/" className="account-back">← Back to shopping</Link></section></main>;
  return <main className="account-page"><header className="account-header"><Link href="/" className="account-logo"><span aria-hidden="true">{STORE_INITIAL}</span>{STORE_NAME}</Link><nav><Link href="/">Shop</Link><Link href="/checkout">Cart</Link><button onClick={logout} disabled={busy}>Sign out</button></nav></header><div className="account-shell">{error && <p className="account-error" role="alert">{error}</p>}<section className="account-welcome"><span>MY ACCOUNT</span><h1>Hello, {data.user?.firstName}.</h1><p>Manage your account and follow every order from checkout to delivery.</p></section><div className="account-dashboard"><aside><div className="account-avatar">{data.user?.firstName.charAt(0)}{data.user?.lastName.charAt(0)}</div><strong>{data.user?.firstName} {data.user?.lastName}</strong><span>{data.user?.email}</span><nav aria-label="Account sections">{sections.map(section => <button key={section} className={active === section ? "active" : ""} aria-pressed={active === section} onClick={() => setActive(section)}>{section}</button>)}</nav></aside>{active === "Profile" ? <section className="account-orders"><h2>Your profile</h2><dl><dt>Name</dt><dd>{data.user?.firstName} {data.user?.lastName}</dd><dt>Email</dt><dd>{data.user?.email}</dd><dt>Phone</dt><dd>{data.user?.phone || "No phone number saved"}</dd></dl></section> : active === "Saved items" ? <section className="account-orders"><h2>Your saved items</h2><p>Items saved on this browser.</p>{saved.length ? <ul>{saved.map(product => <li key={product.id}><Link href={`/products/${product.slug}`}>{product.name}</Link> <button type="button" onClick={() => toggleSaved(product.id)}>Remove</button></li>)}</ul> : <p>{catalogLoading ? "Loading saved items..." : "No saved products yet."}</p>}</section> : <section className="account-orders"><div className="account-section-title"><div><span>ORDER HISTORY</span><h2>Your orders</h2></div><b>{data.orders.length}</b></div>{data.orders.length===0?<div className="account-empty"><h3>No orders yet</h3><p>When you place an order using this email, it will appear here.</p><Link href="/" className="primary-button">Start shopping</Link></div>:<div className="account-order-list">{data.orders.map(order=><article key={order.id}><div><span>{new Date(order.createdAt).toLocaleDateString()}</span><strong>{order.orderNumber}</strong></div><div><span>Status</span><strong>{order.fulfillmentStatus}</strong></div><div><span>Payment</span><strong>{order.paymentStatus}</strong></div><strong>{money(order.totalMinor/100)}</strong></article>)}</div>}</section>}</div></div></main>}
