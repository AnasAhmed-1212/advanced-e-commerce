"use client";

import { useEffect, useState } from "react";
import { activityLabels, type VisitorReport } from "../lib/storefront-activity";

type Result = { page: number; visitor: string | null; report?: VisitorReport; error?: string };

export function AdminVisitors() {
  const [page, setPage] = useState(1);
  const [visitor, setVisitor] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result>();
  const current = result?.page === page && result.visitor === visitor ? result : undefined;
  const report = current?.report;

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (visitor) params.set("visitor", visitor);
    let request: AbortController | undefined;
    async function load() {
      if (request) return;
      const controller = new AbortController();
      request = controller;
      try {
        const response = await fetch("/api/v1/admin/visitors?" + params, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data: VisitorReport = await response.json();
        if (!controller.signal.aborted) setResult({ page, visitor, report: data });
      } catch {
        if (!controller.signal.aborted) {
          setResult(previous => ({
            page, visitor, error: "Unable to refresh visitor activity.",
            report: previous?.page === page && previous.visitor === visitor ? previous.report : undefined,
          }));
        }
      } finally {
        request = undefined;
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (page === 1 && document.visibilityState === "visible") void load();
    }, 15_000);
    return () => { window.clearInterval(timer); request?.abort(); };
  }, [page, visitor, revision]);

  function selectVisitor(id: string | null) {
    setPage(1);
    setVisitor(id);
  }

  const metrics = [
    { label: "Active now", count: report?.active, detail: "Seen in the last 5 minutes" },
    { label: "Visitors in the last 24 hours", count: report?.today, detail: "Unique browsers" },
    { label: "Total visitors", count: report?.total, detail: "Since tracking started" },
  ];

  return <>
    <div className="metric-grid">
      {metrics.map(metric => <article key={metric.label} className="metric-card blue">
        <span>{metric.label}</span><strong>{metric.count?.toLocaleString() ?? "…"}</strong><small>{metric.detail}</small>
      </article>)}
    </div>
    <section className="admin-card management-card">
      <div className="manage-tools">
        <h2>{visitor ? "Activity for visitor " + visitor.slice(0, 8) : "Storefront activity"}</h2>
        {visitor && <button type="button" className="admin-secondary" onClick={() => selectVisitor(null)}>All visitors</button>}
        <button type="button" className="admin-secondary" onClick={() => setRevision(value => value + 1)}>Refresh</button>
      </div>
      {current?.error && <p className="form-error" role="alert">{current.error}</p>}
      <div className="admin-table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Visitor</th><th>Activity</th><th>Page</th></tr></thead>
          <tbody>{report?.activity.map(entry => <tr key={entry.id}>
            <td><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time></td>
            <td><button type="button" className="order-open" title={entry.visitorId}
              onClick={() => selectVisitor(entry.visitorId)}>{entry.visitorId.slice(0, 8)}</button></td>
            <td>{activityLabels[entry.kind]}</td><td>{entry.path}</td>
          </tr>)}</tbody>
        </table>
        {!current && <p className="admin-empty" role="status">Loading visitor activity…</p>}
        {report?.activity.length === 0 && <p className="admin-empty">{page > 1 ? "No activity on this page." : "No storefront activity recorded yet."}</p>}
      </div>
      {report && (page > 1 || report.hasMore) && <div className="manage-tools" aria-label="Activity pages">
        <button type="button" className="admin-secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button>
        <span>Page {page}</span>
        <button type="button" className="admin-secondary" disabled={!report.hasMore} onClick={() => setPage(value => value + 1)}>Next</button>
      </div>}
    </section>
  </>;
}
