"use client";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Package, Share2 } from "lucide-react";
import type { ShopProduct } from "../../lib/catalog-types";
import ImageLightbox from "../../image-lightbox";
import styles from "./product-detail.module.css";

export default function ProductGallery({product}:{product:ShopProduct}){
  const[index,setIndex]=useState(0),[viewer,setViewer]=useState(false),[message,setMessage]=useState("");
  const stage=useRef<HTMLDivElement>(null),image=product.images[index];
  function move(step:number){setIndex(current=>(current+step+product.images.length)%product.images.length);}
  async function share(){try{if(navigator.share)await navigator.share({title:product.name,url:window.location.href});else{await navigator.clipboard.writeText(window.location.href);setMessage("Product link copied.");}}catch(error){if(!(error instanceof Error&&error.name==="AbortError"))setMessage("Copy the page address from your browser to share this product.");}}
  return <div className={styles.gallery}>
    <div className={`${styles.thumbnails} gallery-thumbs`}>{product.images.map((item,i)=><button type="button" key={item.id} aria-label={`View image ${i+1}`} aria-pressed={i===index} onClick={()=>setIndex(i)}><img src={item.url} alt="" width={64} height={64}/></button>)}</div>
    <div ref={stage} className={`${styles.stage} gallery-main`} onPointerMove={event=>{if(event.pointerType!=="mouse")return;const box=event.currentTarget.getBoundingClientRect();stage.current?.style.setProperty("--detail-x",`${(event.clientX-box.left)/box.width*100}%`);stage.current?.style.setProperty("--detail-y",`${(event.clientY-box.top)/box.height*100}%`);}}>
      {image?<button type="button" className={styles.mainImageButton} aria-label={`Enlarge image ${index+1}`} onClick={()=>setViewer(true)}><img className={styles.mainImage} src={image.url} alt={`${product.name} — image ${index+1}`} width={image.width} height={image.height}/></button>:<div className={styles.noImage}><Package size={60} strokeWidth={1}/><span>Product image coming soon</span></div>}
      {image&&<button type="button" className={styles.expand} aria-label="Open full-screen gallery" onClick={()=>setViewer(true)}><Expand size={16}/><span>{index+1} / {product.images.length}</span></button>}
      {product.images.length>1&&<><button type="button" className={`${styles.galleryArrow} ${styles.galleryPrevious}`} aria-label="Previous product image" onClick={()=>move(-1)}><ChevronLeft size={18}/></button><button type="button" className={`${styles.galleryArrow} ${styles.galleryNext}`} aria-label="Next product image" onClick={()=>move(1)}><ChevronRight size={18}/></button></>}
    </div>
    <div className={styles.galleryFooter}><button type="button" onClick={()=>void share()}><Share2 size={14}/>Share</button><span role="status">{message||(image?"Hover to zoom · Click to enlarge":"Ask us for more product details")}</span></div>
    {viewer&&<ImageLightbox name={product.name} images={product.images} initialIndex={index} onClose={()=>setViewer(false)}/>}
  </div>;
}
