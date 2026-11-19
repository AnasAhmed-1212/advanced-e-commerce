import "server-only";
import { query } from "./db";
import type { SaleRange, SalesReport } from "./sales-report";

const ledgerPageSize = 30;

export async function getSalesReport(range: SaleRange, page: number): Promise<SalesReport> {
  const bucket = range === 0 || range === 365 ? "month" : range === 90 ? "week" : "day";
  const result = await query<{ report: SalesReport }>(
    `WITH calendar AS (
       SELECT (now() AT TIME ZONE 'Asia/Karachi')::date AS today
     ), classified AS (
       SELECT o.*, date_trunc($2, o.created_at AT TIME ZONE 'Asia/Karachi') AS bucket,
         CASE
           WHEN o.fulfillment_status = 'returned' THEN 'returned'
           WHEN o.order_status = 'cancelled' THEN 'cancelled'
           WHEN o.payment_status = 'refunded' THEN 'refunded'
           WHEN o.payment_status = 'paid' AND o.inventory_status = 'fulfilled' THEN 'sold'
           ELSE 'pending'
         END AS state
       FROM orders o CROSS JOIN calendar
       WHERE o.currency = 'PKR' AND o.created_at < (today + 1)::timestamp AT TIME ZONE 'Asia/Karachi'
         AND ($1 = 0 OR o.created_at >= (today - ($1::int - 1))::timestamp AT TIME ZONE 'Asia/Karachi')
     ), items AS (
       SELECT c.id AS order_id, c.state, i.variant_id, i.sku_snapshot, i.title_snapshot, i.quantity,
         i.line_total_minor, i.unit_cost_minor * i.quantity AS cost_minor
       FROM classified c JOIN order_items i ON i.order_id = c.id
     ), item_totals AS (
       SELECT order_id, sum(quantity) AS units, sum(line_total_minor) AS sales_minor,
         coalesce(sum(cost_minor), 0) AS cost_minor,
         coalesce(sum(quantity) FILTER (WHERE cost_minor IS NULL), 0) AS missing_units
       FROM items GROUP BY order_id
     ), ledger AS (
       SELECT c.id, c.order_number, c.created_at, c.bucket, c.state, c.order_status, c.payment_status,
         c.fulfillment_status, c.total_minor, c.shipping_minor, c.tax_minor,
         CASE WHEN c.state = 'sold' THEN coalesce(i.units, 0) ELSE 0 END AS sold_units,
         CASE WHEN c.state = 'pending' THEN coalesce(i.units, 0) ELSE 0 END AS pending_units,
         CASE WHEN c.state NOT IN ('sold', 'pending') THEN coalesce(i.units, 0) ELSE 0 END AS reversed_units,
         CASE WHEN c.state = 'sold' THEN coalesce(i.sales_minor, 0) ELSE 0 END AS sales_minor,
         CASE WHEN c.state = 'sold' THEN coalesce(i.cost_minor, 0) ELSE 0 END AS cost_minor,
         CASE WHEN c.state = 'sold' THEN coalesce(i.missing_units, 0) ELSE 0 END AS missing_units,
         CASE WHEN c.state IN ('sold', 'pending') AND c.payment_status = 'paid' THEN c.total_minor ELSE 0 END AS collected_minor,
         CASE WHEN c.state = 'pending' AND c.payment_status IN ('pending', 'unpaid') THEN c.total_minor ELSE 0 END AS open_minor
       FROM classified c LEFT JOIN item_totals i ON i.order_id = c.id
     ), totals AS (
       SELECT count(*) AS orders, coalesce(sum(sold_units), 0) AS sold_units,
         coalesce(sum(pending_units), 0) AS pending_units, coalesce(sum(reversed_units), 0) AS reversed_units,
         coalesce(sum(sales_minor), 0) AS sales_minor, coalesce(sum(cost_minor), 0) AS cost_minor,
         coalesce(sum(missing_units), 0) AS missing_units, coalesce(sum(collected_minor), 0) AS collected_minor,
         coalesce(sum(open_minor), 0) AS open_minor,
         count(*) FILTER (WHERE state = 'sold') AS sold,
         count(*) FILTER (WHERE state = 'pending') AS pending,
         count(*) FILTER (WHERE state = 'cancelled') AS cancelled,
         count(*) FILTER (WHERE state = 'returned') AS returned,
         count(*) FILTER (WHERE state = 'refunded') AS refunded
       FROM ledger
     ), periods AS (
       SELECT generate_series(
         CASE WHEN $1 = 0 THEN coalesce((SELECT min(bucket) FROM ledger), date_trunc($2, today::timestamp))
              ELSE date_trunc($2, (today - ($1::int - 1))::timestamp) END,
         date_trunc($2, today::timestamp), ('1 ' || $2)::interval
       ) AS date FROM calendar
     ), trend AS (
       SELECT bucket, sum(sales_minor) AS sales_minor, sum(sales_minor - cost_minor) AS known_profit,
         sum(missing_units) AS missing_units, sum(sold_units) AS sold_units, sum(pending_units) AS pending_units
       FROM ledger GROUP BY bucket
     ), product_totals AS (
       SELECT coalesce(v.product_id::text, i.sku_snapshot) AS key, max(coalesce(p.title, i.title_snapshot)) AS title,
         coalesce(sum(i.quantity) FILTER (WHERE i.state = 'sold'), 0) AS sold_units,
         coalesce(sum(i.quantity) FILTER (WHERE i.state = 'pending'), 0) AS pending_units,
         coalesce(sum(i.quantity) FILTER (WHERE i.state NOT IN ('sold', 'pending')), 0) AS reversed_units,
         coalesce(sum(i.line_total_minor) FILTER (WHERE i.state = 'sold'), 0) AS sales_minor,
         coalesce(sum(i.cost_minor) FILTER (WHERE i.state = 'sold'), 0) AS cost_minor,
         coalesce(sum(i.quantity) FILTER (WHERE i.state = 'sold' AND i.cost_minor IS NULL), 0) AS missing_units
       FROM items i LEFT JOIN product_variants v ON v.id = i.variant_id LEFT JOIN products p ON p.id = v.product_id
       GROUP BY coalesce(v.product_id::text, i.sku_snapshot)
       ORDER BY sales_minor DESC, sold_units DESC, pending_units DESC, key
       LIMIT 25
     ), ledger_page AS (
       SELECT * FROM ledger ORDER BY created_at DESC, id DESC LIMIT $3 + 1 OFFSET $4
     )
     SELECT json_build_object(
       'summary', json_build_object(
         'orders', t.orders, 'soldUnits', t.sold_units, 'pendingUnits', t.pending_units, 'reversedUnits', t.reversed_units,
         'salesMinor', t.sales_minor, 'costMinor', t.cost_minor, 'collectedMinor', t.collected_minor, 'openMinor', t.open_minor,
         'missingCostUnits', t.missing_units, 'profitMinor', CASE WHEN t.missing_units = 0 THEN t.sales_minor - t.cost_minor END
       ),
       'statuses', json_build_object('sold', t.sold, 'pending', t.pending, 'cancelled', t.cancelled, 'returned', t.returned, 'refunded', t.refunded),
       'trend', coalesce((SELECT json_agg(json_build_object(
         'date', p.date::date::text, 'salesMinor', coalesce(b.sales_minor, 0), 'soldUnits', coalesce(b.sold_units, 0),
         'pendingUnits', coalesce(b.pending_units, 0), 'profitMinor',
         CASE WHEN coalesce(b.missing_units, 0) = 0 THEN coalesce(b.known_profit, 0) END
       ) ORDER BY p.date) FROM periods p LEFT JOIN trend b ON b.bucket = p.date), '[]'::json),
       'products', coalesce((SELECT json_agg(json_build_object(
         'key', p.key, 'title', p.title, 'soldUnits', p.sold_units, 'pendingUnits', p.pending_units, 'reversedUnits', p.reversed_units,
         'salesMinor', p.sales_minor, 'missingCostUnits', p.missing_units,
         'profitMinor', CASE WHEN p.missing_units = 0 THEN p.sales_minor - p.cost_minor END
       ) ORDER BY p.sales_minor DESC, p.sold_units DESC, p.pending_units DESC, p.key) FROM product_totals p), '[]'::json),
       'ledger', coalesce((SELECT json_agg(json_build_object(
         'id', l.id, 'number', l.order_number, 'date', l.created_at, 'payment', l.payment_status, 'fulfillment', l.fulfillment_status,
         'status', l.state, 'totalMinor', l.total_minor, 'shippingMinor', l.shipping_minor, 'taxMinor', l.tax_minor,
         'soldUnits', l.sold_units, 'pendingUnits', l.pending_units, 'reversedUnits', l.reversed_units,
         'salesMinor', l.sales_minor, 'costMinor', l.cost_minor, 'missingCostUnits', l.missing_units,
         'profitMinor', CASE WHEN l.missing_units = 0 THEN l.sales_minor - l.cost_minor END
       ) ORDER BY l.created_at DESC, l.id DESC)
       FROM (SELECT * FROM ledger_page ORDER BY created_at DESC, id DESC LIMIT $3) l), '[]'::json),
       'hasMore', (SELECT count(*) > $3 FROM ledger_page)
     ) AS report FROM totals t`,
    [range, bucket, ledgerPageSize, (page - 1) * ledgerPageSize],
  );
  return result.rows[0].report;
}
