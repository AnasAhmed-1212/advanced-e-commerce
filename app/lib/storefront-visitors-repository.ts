import "server-only";
import { query } from "./db";
import type { ActivityKind, VisitorReport } from "./storefront-activity";

export async function recordVisitorActivity(visitorId: string, kind: ActivityKind | "heartbeat", path: string) {
  if (kind === "heartbeat") {
    await query(
      `INSERT INTO storefront_visitors (id) VALUES ($1)
       ON CONFLICT (id) DO UPDATE SET last_seen_at = now()
       WHERE storefront_visitors.last_seen_at < now() - interval '30 seconds'`,
      [visitorId],
    );
    return;
  }

  await query(
    `WITH visitor AS (
       INSERT INTO storefront_visitors (id) VALUES ($1)
       ON CONFLICT (id) DO UPDATE SET last_seen_at = GREATEST(storefront_visitors.last_seen_at, now())
       RETURNING id
     )
     INSERT INTO storefront_activity (visitor_id, kind, path)
     SELECT id, $2, $3 FROM visitor`,
    [visitorId, kind, path],
  );
}

export async function getVisitorReport(page: number, visitorId: string | null): Promise<VisitorReport> {
  const pageSize = 50;
  const [totals, entries] = await Promise.all([
    query<{ active: number; today: number; total: number }>(
      `SELECT
        (SELECT count(*)::int FROM storefront_visitors WHERE last_seen_at >= now() - interval '5 minutes') AS active,
        (SELECT count(*)::int FROM storefront_visitors WHERE last_seen_at >= now() - interval '24 hours') AS today,
        (SELECT count(*)::int FROM storefront_visitors) AS total`,
    ),
    query<{ id: string; visitor_id: string; kind: ActivityKind; path: string; occurred_at: Date }>(
      `SELECT id, visitor_id, kind, path, occurred_at
       FROM storefront_activity
       ${visitorId ? "WHERE visitor_id = $3" : ""}
       ORDER BY occurred_at DESC, id DESC LIMIT $1 OFFSET $2`,
      [pageSize + 1, (page - 1) * pageSize, ...(visitorId ? [visitorId] : [])],
    ),
  ]);
  return {
    ...totals.rows[0],
    hasMore: entries.rows.length > pageSize,
    activity: entries.rows.slice(0, pageSize).map(row => ({
      id: row.id, visitorId: row.visitor_id, kind: row.kind, path: row.path, occurredAt: row.occurred_at.toISOString(),
    })),
  };
}
