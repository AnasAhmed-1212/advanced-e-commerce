"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import type { MediaImage } from "./lib/catalog-types";
import styles from "./product-ui.module.css";

export default function ImageLightbox({ name,images,initialIndex=0,onClose }: { name: string; images: MediaImage[]; initialIndex?: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index,setIndex] = useState(initialIndex), [zoom,setZoom] = useState(false);
  const image = images[index];
  function move(step: number) { setIndex(current => (current+step+images.length)%images.length); setZoom(false); }
  useEffect(() => {
    const node = dialog.current, previous = document.activeElement;
    node?.showModal();
    return () => { node?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({preventScroll:true}); };
  },[]);
  return <dialog ref={dialog} className={styles.lightbox} aria-label={`Images of ${name}`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
  }}>
    <div className={styles.lightboxInner}>
      <header><div><strong>{name}</strong><span>Image {index+1} of {images.length}</span></div><button type="button" aria-label={zoom ? "Zoom out" : "Zoom in"} onClick={() => setZoom(value => !value)}>{zoom ? <Minus size={20}/> : <Plus size={20}/>}</button><button type="button" aria-label="Close image viewer" onClick={onClose}><X size={22}/></button></header>
      <div className={`${styles.lightboxStage} ${zoom ? styles.enlarged : ""}`}><button type="button" className={styles.lightboxImage} aria-label={zoom ? "Reset image zoom" : "Enlarge image"} onClick={() => setZoom(value => !value)}>{image && <img src={image.url} alt={`${name} — image ${index+1}`} width={image.width} height={image.height}/>}</button></div>
      {images.length > 1 && <><button type="button" className={`${styles.lightboxArrow} ${styles.previous}`} aria-label="Previous image" onClick={() => move(-1)}><ChevronLeft/></button><button type="button" className={`${styles.lightboxArrow} ${styles.next}`} aria-label="Next image" onClick={() => move(1)}><ChevronRight/></button><div className={styles.lightboxThumbs}>{images.map((item,i) => <button type="button" key={item.id} aria-label={`Open image ${i+1}`} aria-pressed={index === i} onClick={() => { setIndex(i); setZoom(false); }}><img src={item.url} alt="" width={64} height={64}/></button>)}</div></>}
    </div>
  </dialog>;
}
