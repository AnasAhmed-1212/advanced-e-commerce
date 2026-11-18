"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { STORE_INITIAL, STORE_NAME } from "../lib/brand";

export function AdminLogin({ configured, onSuccess }: { configured: boolean; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in.");
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="admin-auth-page"><section className="admin-auth-card"><Link href="/" className="admin-auth-brand"><span aria-hidden="true">{STORE_INITIAL}</span><strong>{STORE_NAME}</strong><small>ADMIN</small></Link><div className="admin-auth-copy"><span>SECURE WORKSPACE</span><h1>Welcome back.</h1><p>Sign in to manage products, orders, inventory, and store performance.</p></div>{!configured&&<div className="admin-auth-setup"><strong>One-time setup required</strong><p>Run <code>npm.cmd run admin:configure</code> in PowerShell, then restart the development server.</p></div>}<form onSubmit={submit}><label>Email address<input type="email" autoComplete="username" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="you@example.com" required disabled={!configured}/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="Enter your password" required disabled={!configured}/></label>{error&&<p className="admin-auth-error" role="alert">{error}</p>}<button type="submit" disabled={!configured||loading}>{loading?"Signing in…":"Sign in securely"}</button></form><Link href="/" className="admin-auth-return">← Return to storefront</Link></section><aside className="admin-auth-art"><div><span>STORE COMMAND CENTER</span><h2>Everything important, at a glance.</h2><p>Monitor sales, fulfill orders, and keep inventory moving from one calm workspace.</p></div></aside></main>;
}
