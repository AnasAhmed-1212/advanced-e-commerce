import { checkOrigin, CommerceError } from "../../../../lib/api-errors";
import { UUID_PATTERN } from "../../../../lib/catalog-types";
import { activityLabels, isStorefrontPath, type ActivityKind } from "../../../../lib/storefront-activity";
import { recordVisitorActivity } from "../../../../lib/storefront-visitors-repository";

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 415 });
  if (Number(request.headers.get("content-length")) > 1024) return new Response(null, { status: 413 });

  try {
    checkOrigin(request);
    const text = await request.text();
    if (text.length > 1024) return new Response(null, { status: 413 });
    const body = JSON.parse(text);
    if (!body || typeof body.visitorId !== "string" || !UUID_PATTERN.test(body.visitorId) ||
        typeof body.kind !== "string" || (body.kind !== "heartbeat" && !Object.hasOwn(activityLabels, body.kind)) ||
        typeof body.path !== "string" || !isStorefrontPath(body.path)) {
      return new Response(null, { status: 400 });
    }
    await recordVisitorActivity(body.visitorId, body.kind as ActivityKind | "heartbeat", body.path);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof CommerceError) return new Response(null, { status: error.status });
    if (error instanceof SyntaxError) return new Response(null, { status: 400 });
    return new Response(null, { status: 503 });
  }
}
