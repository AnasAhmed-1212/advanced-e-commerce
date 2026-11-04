import { checkOrigin } from "../../../lib/api-errors";
import { CHAT_BODY_LIMIT, ChatError, validateChat } from "../../../lib/chatbot-policy";
import { generateChat, reserveChat } from "../../../lib/chatbot";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    checkOrigin(request);
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new ChatError("Request origin is not allowed.",403);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ChatError("Send a JSON message.",415);
    if (Number(request.headers.get("content-length")) > CHAT_BODY_LIMIT) throw new ChatError("This message is too long.",413);
    // Limit bytes while reading as well; Content-Length is optional and can be misleading.
    const reader = request.body?.getReader();
    if (!reader) throw new ChatError("Please send a message.");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done,value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > CHAT_BODY_LIMIT) { await reader.cancel(); throw new ChatError("This message is too long.",413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ChatError("Send a valid JSON message."); }
    const messages = validateChat(input);
    release = reserveChat(request);
    return Response.json(await generateChat(messages,request.signal),{ headers });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 503;
    const message = error instanceof Error && status !== 503 ? error.message : error instanceof ChatError ? error.message : "The assistant is temporarily unavailable. Please try again later.";
    return Response.json({ error: message },{ status,headers: { ...headers,...(status === 429 ? { "Retry-After": "300" } : {}) } });
  } finally { release?.(); }
}
