import { query } from "../../../lib/db";
import { UUID_PATTERN } from "../../../lib/catalog-types";
export async function GET(request: Request, {params}: {params:Promise<{id:string}>}) {
  const {id}=await params; if (!UUID_PATTERN.test(id)) return new Response(null,{status:404});
  try {
    const result=await query<{data:Buffer;content_type:string}>("SELECT data,content_type FROM media_assets WHERE id=$1",[id]); if (!result.rows[0]) return new Response(null,{status:404});
    const etag=`"${id}"`; const headers={"Content-Type":result.rows[0].content_type,"Cache-Control":"public, max-age=31536000, immutable","ETag":etag,"X-Content-Type-Options":"nosniff"};
    if (request.headers.get("if-none-match")===etag) return new Response(null,{status:304,headers});
    return new Response(new Uint8Array(result.rows[0].data),{headers});
  } catch { return new Response(null,{status:503}); }
}
