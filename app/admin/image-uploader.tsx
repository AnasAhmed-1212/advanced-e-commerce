"use client";
import { useRef, useState } from "react";
import type { MediaImage } from "../lib/catalog-types";

type Props={images:MediaImage[];onChange:(images:MediaImage[])=>void;max?:number;onBusyChange?:(busy:boolean)=>void;disabled?:boolean};
export function ImageUploader({images,onChange,max=10,onBusyChange,disabled=false}:Props){
  const input=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[progress,setProgress]=useState(""),[over,setOver]=useState(false);
  function move(from:number,to:number){if(from===to||from<0||to<0||to>=images.length)return;const next=[...images];next.splice(to,0,next.splice(from,1)[0]);onChange(next);}
  async function upload(files:FileList|File[]|null){
    if(!files||busy||disabled)return;
    const selected=Array.from(files);setError("");
    if(selected.length+images.length>max){setError(`Choose up to ${max} image${max===1?"":"s"}. Remove an existing image to replace it.`);return;}
    setBusy(true);onBusyChange?.(true);const next=[...images];
    try{
      for(const [index,file]of selected.entries()){
        if(file.size>12*1024*1024)throw new Error(`${file.name} exceeds the 12 MB limit.`);
        if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type))throw new Error(`${file.name}: choose JPEG, PNG, WebP or AVIF.`);
        setProgress(`Compressing and uploading ${index+1} of ${selected.length}…`);
        const data=new FormData();data.set("file",file);
        const response=await fetch("/api/v1/admin/uploads",{method:"POST",body:data});const result=await response.json();
        if(!response.ok)throw new Error(result.error||"Upload failed.");
        next.push(result.image);onChange([...next]);
      }
    }catch(reason){setError(reason instanceof Error?reason.message:"Upload failed. Please try again.");}
    finally{setBusy(false);onBusyChange?.(false);setProgress("");if(input.current)input.current.value="";}
  }
  return <fieldset className="image-uploader" disabled={busy||disabled}><legend>{max===1?"Category image":"Product images"}</legend><p className="field-hint">{max===1?"Add a cover for this category.":"Drag images to reorder. The first image is the cover. Arrow buttons work on mobile and with a keyboard."} Images are automatically compressed to WebP.</p><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple={max>1} hidden onChange={e=>void upload(e.target.files)}/><div className={`upload-dropzone ${over?"drag-over":""}`} onDragOver={e=>{e.preventDefault();if(e.dataTransfer.types.includes("Files"))setOver(true);}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);if(e.dataTransfer.files.length)void upload(e.dataTransfer.files);}}><button type="button" disabled={images.length>=max||busy||disabled} onClick={()=>input.current?.click()}>{busy?progress:"+ Upload images or drop files here"}</button><small>JPEG, PNG, WebP, AVIF · up to 12 MB each · {images.length}/{max}</small></div><div className="upload-image-grid">{images.map((image,index)=><div className="upload-image" key={image.id} draggable={!busy&&!disabled} onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("application/x-northstar-image",image.id);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";}} onDrop={e=>{e.preventDefault();e.stopPropagation();const source=images.findIndex(item=>item.id===e.dataTransfer.getData("application/x-northstar-image"));if(source>=0)move(source,index);}}><img draggable={false} src={image.url} alt={`Uploaded image ${index+1}`} width={image.width} height={image.height}/><span className="image-order">{index===0?"Cover":index+1}</span><div className="image-controls"><button type="button" disabled={index===0||busy} aria-label={`Move image ${index+1} earlier`} onClick={()=>move(index,index-1)}>←</button><button type="button" disabled={index===images.length-1||busy} aria-label={`Move image ${index+1} later`} onClick={()=>move(index,index+1)}>→</button><button type="button" aria-label={`Remove image ${index+1}`} onClick={()=>onChange(images.filter(item=>item.id!==image.id))}>×</button></div><small>{Math.ceil(image.sizeBytes/1024)} KB · {image.width} × {image.height}</small></div>)}</div>{error&&<p className="form-error" role="alert">{error}</p>}<p className="sr-only" aria-live="polite">{progress}</p></fieldset>;
}
