export class CommerceError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function logCatalogFailure(error: unknown) {
  const rawCode = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  const code = error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED"
    ? "DATABASE_NOT_CONFIGURED"
    : typeof rawCode === "string" && /^[A-Z0-9_]{2,48}$/.test(rawCode) ? rawCode : "UNKNOWN";
  const rawHostname = typeof error === "object" && error !== null && "hostname" in error ? error.hostname : undefined;
  const hostname = ["ENOTFOUND", "EAI_AGAIN"].includes(code)
    && typeof rawHostname === "string" && rawHostname.length <= 253
    && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(rawHostname)
    ? rawHostname : undefined;
  // DNS errors expose only the lookup hostname, never credentials or the URI.
  // Do not log the full error: its message can contain connection details.
  console.error("Catalog database request failed", { code, ...(hostname ? { hostname } : {}) });
}
export function isConnectionError(error: unknown) {
  if (!error || typeof error!=="object") return false;
  const code="code" in error?error.code:"";
  const message=error instanceof Error?error.message:"";
  return ["ECONNRESET","ECONNREFUSED","ETIMEDOUT","EPIPE","EAI_AGAIN","ENETUNREACH","08000","08003","08006","57P01","57P02","57P03","53300"].includes(String(code)) || /connection (?:terminated|timeout)|timeout exceeded when trying to connect|client has encountered a connection error/i.test(message);
}
export function apiError(error: unknown) {
  if (error instanceof CommerceError) return Response.json({ error: error.message }, { status: error.status });
  if (isConnectionError(error)) return Response.json({error:"The database connection was interrupted. Please retry."},{status:503});
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : "";
  if (code === "57014") return Response.json({error:"The database took too long to respond. Please retry."},{status:503});
  if (code === "23505") return Response.json({ error: "That URL slug is already in use. Choose another." }, { status: 409 });
  if (code === "23503") return Response.json({ error: "This record is in use, or a selected category or image no longer exists." }, { status: 409 });
  console.error("Commerce request failed", code || "UNKNOWN");
  return Response.json({ error: "Unable to save changes. Please try again." }, { status: 500 });
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new CommerceError("Request origin is not allowed.", 403);
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body;
  try { body = await request.json(); } catch { throw new CommerceError("Request must contain valid JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CommerceError("Invalid request.");
  return body;
}
