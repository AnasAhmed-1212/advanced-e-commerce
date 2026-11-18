"use client";

import { useEffect, useState } from "react";

type Customer = { id: string; email: string; firstName: string; lastName: string; status: string; createdAt: string };
type Result = { customers: Customer[]; hasMore: boolean };

export function AdminCustomers() {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ page: number; revision: number; data?: Result; error?: string }>();
  const current = result?.page === page && result.revision === revision ? result : undefined;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/v1/admin/customers?page=${page}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json() as Result;
        if (!controller.signal.aborted) setResult({ page, revision, data });
      } catch {
        if (!controller.signal.aborted) setResult({ page, revision, error: "Unable to load customers. Try refreshing." });
      }
    }
    void load();
    return () => controller.abort();
  }, [page, revision]);

  return <section className="admin-card management-card">
    <div className="manage-tools">
      <button type="button" className="admin-secondary" onClick={() => { setPage(1); setRevision(value => value + 1); }}>Refresh</button>
    </div>
    {current?.error && <p className="form-error" role="alert">{current.error}</p>}
    <div className="admin-table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Status</th></tr></thead>
        <tbody>{current?.data?.customers.map(customer => <tr key={customer.id}>
          <td>{customer.firstName} {customer.lastName}</td><td>{customer.email}</td>
          <td>{new Date(customer.createdAt).toLocaleDateString()}</td><td>{customer.status}</td>
        </tr>)}</tbody>
      </table>
      {!current && <p className="admin-empty" role="status">Loading customers...</p>}
      {current?.data?.customers.length === 0 && <p className="admin-empty">No customers on this page.</p>}
    </div>
    {current?.data && (page > 1 || current.data.hasMore) && <div className="manage-tools" aria-label="Customer pages">
      <button type="button" className="admin-secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button>
      <span>Page {page}</span>
      <button type="button" className="admin-secondary" disabled={!current.data.hasMore} onClick={() => setPage(value => value + 1)}>Next</button>
    </div>}
  </section>;
}
