"use client";

import { useEffect, useState } from "react";
import { money } from "../catalog";
import { saleRanges, type SaleRange, type SalesReport } from "../lib/sales-report";
import styles from "./admin-sales.module.css";

const ranges: Record<SaleRange, string> = { 7: "Last 7 days", 30: "Last 30 days", 90: "Last 90 days", 365: "Last 365 days", 0: "All time" };
const labels = { sold: "Sold", pending: "Pending", cancelled: "Cancelled", returned: "Returned", refunded: "Refunded" };
const chartMetrics = { salesMinor: "Merchandise sales", profitMinor: "Gross profit", soldUnits: "Units sold", pendingUnits: "Units pending" };
const count = (value: number) => value.toLocaleString();
const pkr = (value: number) => money(value / 100);
const profit = (value: number | null) => value === null ? "Cost missing" : pkr(value);
const periodDate = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", timeZone: "UTC" });
const orderDate = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" });

function SalesTrend({ trend, range }: { trend: SalesReport["trend"]; range: SaleRange }) {
  const [metric, setMetric] = useState<keyof typeof chartMetrics>("salesMinor");
  const [selected, setSelected] = useState<string>();
  const monthly = range === 0 || range === 365;
  const groupedDate = new Intl.DateTimeFormat("en-PK", { month: "short", year: "2-digit", timeZone: "UTC" });
  const dateOf = (date: string) => (monthly ? groupedDate : periodDate).format(new Date(date + "T00:00:00Z"));
  const valueOf = (value: number | null) => value === null ? "Cost missing" : metric.endsWith("Minor") ? pkr(value) : count(value);
  const low = Math.min(0, ...trend.map(point => point[metric] ?? 0));
  const high = Math.max(0, ...trend.map(point => point[metric] ?? 0));
  const span = high - low || 1;
  const baseline = (high ? high / span : low ? 0 : 1) * 100;
  const point = trend.find(entry => entry.date === selected) ?? trend.at(-1);

  return <section className={`admin-card ${styles.card}`}>
    <header className={styles.sectionHeader}>
      <div><h2>Sales trend</h2><p>By order date · {monthly ? "Monthly" : range === 90 ? "Weekly" : "Daily"}</p></div>
      <select aria-label="Chart metric" value={metric} onChange={event => setMetric(event.target.value as keyof typeof chartMetrics)}>
        {Object.entries(chartMetrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </header>
    <div className={styles.chartSummary} aria-live="polite">{point && <>{dateOf(point.date)} <strong>{valueOf(point[metric])}</strong></>}</div>
    <div className={styles.chartScroll}>
      <div className={styles.chart} aria-label={chartMetrics[metric] + " by order date"}>
        {trend.map((entry, index) => {
          const value = entry[metric];
          const height = Math.abs(value ?? 0) / span * 100;
          const label = dateOf(entry.date) + " · " + valueOf(value);
          return <button key={entry.date} type="button" className={styles.column} aria-label={label} title={label}
            aria-pressed={point?.date === entry.date} onClick={() => setSelected(entry.date)}>
            <span className={styles.plot}>
              <span className={styles.axis} style={{ top: baseline + "%" }}/>
              {value === null ? <span className={styles.missing}>?</span> : value !== 0 && <span
                className={value < 0 ? styles.negativeBar : styles.bar}
                style={{ top: (value >= 0 ? baseline - height : baseline) + "%", height: Math.max(height, 1) + "%" }}/>}
            </span>
            <span className={styles.tick}>{trend.length <= 14 || index % 3 === 0 ? dateOf(entry.date) : ""}</span>
          </button>;
        })}
      </div>
    </div>
  </section>;
}

function OrderBreakdown({ report }: { report: SalesReport }) {
  return <section className={`admin-card ${styles.card}`}>
    <header className={styles.sectionHeader}><div><h2>Order breakdown</h2><p>{count(report.summary.orders)} orders in this period</p></div></header>
    <div className={styles.breakdown}>
      {Object.entries(labels).map(([key, label]) => {
        const value = report.statuses[key as keyof typeof labels];
        return <div key={key}>
          <div><span>{label}</span><strong>{count(value)}</strong></div>
          <progress aria-label={label + " orders"} max={report.summary.orders || 1} value={value}/>
        </div>;
      })}
    </div>
  </section>;
}

export function AdminSales({ onOrder }: { onOrder: (id: string) => void }) {
  const [range, setRange] = useState<SaleRange>(30);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ range: SaleRange; page: number; revision: number; report?: SalesReport; error?: string }>();
  const current = result?.range === range && result.page === page && result.revision === revision ? result : undefined;
  const report = current?.report;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/v1/admin/sales?range=" + range + "&page=" + page, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const data: SalesReport = await response.json();
        if (!controller.signal.aborted) setResult({ range, page, revision, report: data });
      } catch {
        if (!controller.signal.aborted) setResult({ range, page, revision, error: "Unable to load the sales report. Try refreshing." });
      }
    }
    void load();
    return () => controller.abort();
  }, [range, page, revision]);

  const totals = report?.summary;
  const cards = totals ? [
    { label: "Merchandise sales", value: pkr(totals.salesMinor), detail: "Paid and fulfilled orders" },
    { label: "Gross profit", value: profit(totals.profitMinor), detail: totals.missingCostUnits ? count(totals.missingCostUnits) + " sold units need a recorded cost" : "Merchandise sales minus product costs" },
    { label: "Units sold", value: count(totals.soldUnits), detail: "Paid and fulfilled" },
    { label: "Units pending", value: count(totals.pendingUnits), detail: "Awaiting payment or fulfillment" },
    { label: "Payments collected", value: pkr(totals.collectedMinor), detail: "Includes delivery and tax charged" },
    { label: "Payments outstanding", value: pkr(totals.openMinor), detail: "Unpaid or awaiting confirmation" },
    { label: "Product costs", value: pkr(totals.costMinor), detail: totals.missingCostUnits ? "Recorded costs only" : "Cost of units sold" },
    { label: "Units reversed", value: count(totals.reversedUnits), detail: "Cancelled, returned, or refunded" },
  ] : [];

  return <div className={styles.sales}>
    <div className={styles.toolbar}>
      <label>Date range <select value={range} onChange={event => { setRange(Number(event.target.value) as SaleRange); setPage(1); }}>
        {saleRanges.map(option => <option key={option} value={option}>{ranges[option]}</option>)}
      </select></label>
      <button type="button" className="admin-secondary" onClick={() => setRevision(value => value + 1)}>Refresh</button>
      <span>Pakistan time · by order date</span>
    </div>
    {!current && <p className="admin-empty" role="status">Loading sales report…</p>}
    {current?.error && <p className="form-error" role="alert">{current.error}</p>}
    {report && <>
      <div className="metric-grid">{cards.map(card => <article className="metric-card blue" key={card.label}>
        <span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small>
      </article>)}</div>
      <div className={styles.charts}><SalesTrend trend={report.trend} range={range}/><OrderBreakdown report={report}/></div>
      <section className="admin-card management-card">
        <header className={styles.sectionHeader}><div><h2>Product performance</h2><p>Top 25 by merchandise sales, then by units</p></div></header>
        <div className="admin-table-wrap"><table>
          <thead><tr><th>Product</th><th>Sold units</th><th>Pending units</th><th>Reversed units</th><th>Sales</th><th>Gross profit</th></tr></thead>
          <tbody>{report.products.map(product => <tr key={product.key}>
            <td>{product.title}</td><td>{count(product.soldUnits)}</td><td>{count(product.pendingUnits)}</td>
            <td>{count(product.reversedUnits)}</td><td>{pkr(product.salesMinor)}</td>
            <td>{product.soldUnits ? profit(product.profitMinor) : "—"}</td>
          </tr>)}</tbody>
        </table>{!report.products.length && <p className="admin-empty">No product activity in this period.</p>}</div>
      </section>
      <section className="admin-card management-card">
        <header className={styles.sectionHeader}><div><h2>Order ledger</h2><p>Open an order to review its statuses or record a missing item cost.</p></div></header>
        <div className="admin-table-wrap"><table>
          <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Payment</th><th>Fulfillment</th><th>Units</th>
            <th>Merchandise sales</th><th>Delivery charged</th><th>Tax</th><th>Order total</th><th>Gross profit</th></tr></thead>
          <tbody>{report.ledger.map(order => <tr key={order.id}>
            <td><button type="button" className="order-open" onClick={() => onOrder(order.id)}>{order.number}</button></td>
            <td>{orderDate.format(new Date(order.date))}</td><td>{labels[order.status]}</td>
            <td className={styles.status}>{order.payment}</td><td className={styles.status}>{order.fulfillment}</td>
            <td>{count(order.soldUnits + order.pendingUnits + order.reversedUnits)}</td><td>{pkr(order.salesMinor)}</td>
            <td>{pkr(order.shippingMinor)}</td><td>{pkr(order.taxMinor)}</td><td>{pkr(order.totalMinor)}</td>
            <td>{order.soldUnits ? profit(order.profitMinor) : "—"}</td>
          </tr>)}</tbody>
        </table>{!report.ledger.length && <p className="admin-empty">No orders on this page.</p>}</div>
        {(page > 1 || report.hasMore) && <div className="manage-tools" aria-label="Ledger pages">
          <button type="button" className="admin-secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button>
          <span>Page {page}</span>
          <button type="button" className="admin-secondary" disabled={!report.hasMore} onClick={() => setPage(value => value + 1)}>Next</button>
        </div>}
      </section>
      <p className={styles.note}>Gross profit uses recorded product costs. Delivery, tax, payment fees, and operating expenses are outside this calculation.</p>
    </>}
  </div>;
}
