import sharp from "sharp";
import { getAdminSession } from "../../../../lib/admin-session";
import { query } from "../../../../lib/db";
import { apiError, checkOrigin, CommerceError } from "../../../../lib/api-errors";
const MAX_INPUT = 12 * 1024 * 1024;
export async function POST(request: Request) {
  if (!(await getAdminSession())) return Response.json({error:"Unauthorized"},{status:401});
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length") || 0)>MAX_INPUT+65536) throw new CommerceError("Image must be 12 MB or smaller.",413);
    const form=await request.formData(); const file=form.get("file");
    if (!(file instanceof File) || !file.size || file.size>MAX_INPUT) throw new CommerceError("Choose an image of 12 MB or smaller.",413);
    const input=Buffer.from(await file.arrayBuffer());
    let data: Buffer, width: number, height: number;
    try {
      const pipeline=sharp(input,{limitInputPixels:40000000,animated:false}); const metadata=await pipeline.metadata();
      if (!["jpeg","png","webp","avif","heif"].includes(metadata.format || "") || (metadata.pages || 1)>1) throw new Error("Unsupported image");
      const encode=(size:number,quality:number)=>pipeline.clone().rotate().resize({width:size,height:size,fit:"inside",withoutEnlargement:true}).webp({quality,effort:4}).toBuffer({resolveWithObject:true});
      let compressed=await encode(1600,78);
      if(compressed.data.length>512*1024)compressed=await encode(1200,68);
      if(compressed.data.length>512*1024)compressed=await encode(1000,60);
      data=compressed.data; width=compressed.info.width; height=compressed.info.height;
    } catch { throw new CommerceError("Upload a valid, non-animated JPEG, PNG, WebP or AVIF image under 40 megapixels."); }
    if (data.length>2*1024*1024) throw new CommerceError("This image is too complex to compress. Try a smaller image.",413);
    const saved=await query<{id:string}>("INSERT INTO media_assets(data,width,height,size_bytes) VALUES($1,$2,$3,$4) RETURNING id",[data,width,height,data.length]); const id=saved.rows[0].id;
    return Response.json({image:{id,url:`/api/media/${id}`,width,height,sizeBytes:data.length},originalBytes:file.size},{status:201});
  } catch(error) { return apiError(error); }
}
