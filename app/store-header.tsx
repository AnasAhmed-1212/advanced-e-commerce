"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ALargeSmall, ChevronRight, Grid2X2, Heart, House, ListFilter, Mic, Package, ScanSearch, Search, ShoppingCart, UserRound, X } from "lucide-react";
import type { Category } from "./lib/catalog-types";
import styles from "./store-header.module.css";
import { STORE_NAME } from "./lib/brand";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
type Props = {
  categories: Category[];
  category: string;
  query: string;
  itemCount: number;
  favoriteCount: number;
  savedOnly: boolean;
  readable: boolean;
  onQueryChange: (value: string) => void;
  onSearch: (value: string) => void;
  onCategorySelect: (id: string) => void;
  onSavedToggle: () => void;
  onReadableToggle: () => void;
};

export default function StoreHeader({ categories, category, query, itemCount, favoriteCount, savedOnly, readable, onQueryChange, onSearch, onCategorySelect, onSavedToggle, onReadableToggle }: Props) {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const header = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const categoryButton = useRef<HTMLButtonElement>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    if (!categoriesOpen) return;
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setCategoriesOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setCategoriesOpen(false); categoryButton.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [categoriesOpen]);

  useEffect(() => () => {
    if (recognition.current) {
      recognition.current.onresult = null;
      recognition.current.onerror = null;
      recognition.current.onend = null;
      recognition.current.abort();
    }
  }, []);

  function choose(id: string) { setCategoriesOpen(false); onCategorySelect(id); }
  function voiceSearch() {
    if (listening) { recognition.current?.stop(); return; }
    const browser = window as SpeechWindow;
    const SpeechRecognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage("Voice search is unavailable in this browser. Type your search instead.");
      input.current?.focus();
      return;
    }
    const speech = new SpeechRecognition();
    recognition.current = speech;
    speech.lang = document.documentElement.lang || navigator.language;
    speech.continuous = false;
    speech.interimResults = false;
    speech.onresult = event => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (text) { onQueryChange(text); onSearch(text); setMessage(""); }
    };
    speech.onerror = event => {
      setListening(false);
      setMessage(event.error === "not-allowed" ? "Microphone access was not allowed. You can type your search instead." : "We couldn't hear your search. Try again or type a product name.");
    };
    speech.onend = () => setListening(false);
    try { speech.start(); setListening(true); setMessage(""); }
    catch { setListening(false); setMessage("Voice search couldn't start. Please type your search instead."); }
  }

  return <header ref={header} className={styles.header} data-store-header>
    <div className={styles.row}>
      <Link className={styles.brand} href="/" aria-label={`${STORE_NAME} home`}>
        <span className={styles.wordmark}>{STORE_NAME}</span>
        <small>EVERYDAY ESSENTIALS</small>
      </Link>
      <form className={styles.search} role="search" onSubmit={event => { event.preventDefault(); setCategoriesOpen(false); onSearch(query); }}>
        <button type="submit" className={styles.searchIcon} aria-label="Search products"><Search size={18} strokeWidth={1.8}/></button>
        <input ref={input} type="search" value={query} onChange={event => onQueryChange(event.target.value)} onFocus={() => setCategoriesOpen(false)} placeholder="Search products..." aria-label="Search products"/>
        <button type="button" className={`${styles.voice} ${listening ? styles.listening : ""}`} aria-label={listening ? "Stop voice search" : "Search by voice"} aria-pressed={listening} onClick={voiceSearch}><Mic size={17} strokeWidth={1.8}/></button>
      </form>
      <nav className={styles.navigation} aria-label="Main navigation">
        <button type="button" className={`${styles.navItem} ${category === "All" && !savedOnly ? styles.active : ""}`} aria-pressed={category === "All" && !savedOnly} onClick={() => choose("All")}><House size={18} strokeWidth={1.8}/><span>Shop</span></button>
        <button ref={categoryButton} type="button" className={`${styles.navItem} ${category !== "All" ? styles.selected : ""}`} aria-expanded={categoriesOpen} aria-controls="store-category-menu" onClick={() => setCategoriesOpen(open => !open)}><ListFilter size={19} strokeWidth={1.8}/><span>Categories</span></button>
        <button type="button" className={styles.navItem} onClick={() => { setCategoriesOpen(false); input.current?.focus(); input.current?.select(); }}><ScanSearch size={19} strokeWidth={1.8}/><span>Find<span className={styles.findLabel}> product</span></span></button>
        <Link className={styles.navItem} href="/account"><Package size={19} strokeWidth={1.8}/><span>Orders</span></Link>
      </nav>
      <div className={styles.actions}>
        <button type="button" className={`${styles.circle} ${styles.saved} ${savedOnly ? styles.savedActive : ""}`} aria-label={`Saved items (${favoriteCount})`} aria-pressed={savedOnly} title="Saved items" onClick={() => { setCategoriesOpen(false); onSavedToggle(); }}><Heart size={17} strokeWidth={1.8} fill={savedOnly ? "currentColor" : "none"}/>{favoriteCount > 0 && <b className={styles.count}>{favoriteCount}</b>}</button>
        <button type="button" className={`${styles.circle} ${readable ? styles.selected : ""}`} aria-label="Larger text" aria-pressed={readable} title="Toggle larger text" onClick={onReadableToggle}><ALargeSmall size={19} strokeWidth={1.8}/></button>
        <Link className={styles.circle} href="/checkout" aria-label={`Cart with ${itemCount} items`} title="Cart"><ShoppingCart size={19} strokeWidth={1.8}/>{itemCount > 0 && <b className={styles.count}>{itemCount}</b>}</Link>
        <Link className={styles.signIn} href="/account" aria-label="Sign in"><UserRound size={19} strokeWidth={1.8}/><span>Sign in</span></Link>
      </div>
    </div>
    {categoriesOpen && <div className={styles.dropdown} id="store-category-menu" aria-label="Product categories"><div className={styles.dropdownHeading}><strong>Shop by category</strong><button type="button" className={styles.close} aria-label="Close categories" onClick={() => { setCategoriesOpen(false); categoryButton.current?.focus(); }}><X size={17}/></button></div><button type="button" className={styles.categoryOption} onClick={() => choose("All")}><Grid2X2 size={19}/><span>All products</span><ChevronRight size={16}/></button>{categories.length ? <ul>{categories.map(item => <li key={item.id}><button type="button" className={`${styles.categoryOption} ${category === item.id ? styles.selected : ""}`} onClick={() => choose(item.id)}>{item.image ? <img src={item.image.url} alt="" width={32} height={32}/> : <Package size={19}/>}<span>{item.name}<small>{item.productCount} product{item.productCount === 1 ? "" : "s"}</small></span><ChevronRight size={16}/></button></li>)}</ul> : <p className={styles.empty}>New categories will appear here as the collection grows.</p>}</div>}
    {(listening || message) && <div className={styles.notice} role="status"><span>{listening ? "Listening… say a product name." : message}</span>{!listening && <button className={styles.close} type="button" aria-label="Dismiss search message" onClick={() => setMessage("")}><X size={15}/></button>}</div>}
  </header>;
}
