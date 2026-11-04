"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import essentials from "../public/banner/Premium orange-and-black Surgicare product showcase.png";
import monitoring from "../public/banner/health-monitoring.png";
import mobility from "../public/banner/Surgicare Mobility Showcase_ Move With Confidence.png";
import styles from "./hero-slider.module.css";

const slides = [
  { image: essentials, label: "Everyday essentials", alt: "Surgicare: Your health essentials, all in one place. BP monitors, mesh nebulizers, hearing aids, massage guns, walking aids and glucose meters. Shop now." },
  { image: monitoring, label: "Home health monitoring", alt: "Surgicare home health monitoring: Know your numbers, stay in control. Blood pressure monitors, glucose meters, test strips and digital thermometers. Shop now." },
  { image: mobility, label: "Mobility & home care", alt: "Surgicare mobility and home care: Move with confidence. Wheelchairs, folding walkers, commode chairs and walking sticks. Shop now." },
];

export default function HeroSlider() {
  const autoplay = useRef(Autoplay({ delay: 4500, playOnInit: true, stopOnInteraction: false, stopOnMouseEnter: false, stopOnFocusIn: false }));
  const [viewport,api] = useEmblaCarousel({ loop: true, duration: 32, breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } } },[autoplay.current]);
  const [selected,setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    const select = () => setSelected(api.selectedScrollSnap());
    api.on("select",select).on("reInit",select);
    return () => { api.off("select",select).off("reInit",select); };
  },[api]);

  return <section className={styles.hero} aria-label="Featured medical equipment" aria-roledescription="carousel" data-hero-slider onKeyDown={event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      if (event.key === "ArrowLeft") api?.scrollPrev(); else api?.scrollNext();
      autoplay.current.reset();
    }
  }}>
    <h1 className={styles.srOnly}>Medical equipment for everyday care</h1>
    <div className={styles.frame}>
      <div ref={viewport} className={styles.viewport}>
        <div className={styles.track}>
          {slides.map((slide,index) => <div key={slide.label} className={styles.slide} role="group" aria-roledescription="slide" aria-label={`${index+1} of ${slides.length}: ${slide.label}`} aria-hidden={selected !== index}>
            <a href="#products" className={styles.bannerLink} aria-label={`Shop ${slide.label.toLowerCase()}`} tabIndex={selected === index ? 0 : -1} draggable={false}>
              <Image className={styles.image} src={slide.image} alt={slide.alt} sizes="(max-width: 600px) calc(100vw - 24px), (max-width: 1488px) calc(100vw - 48px), 1440px" preload={index === 0} loading={index === 0 ? undefined : "lazy"} draggable={false}/>
            </a>
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}
