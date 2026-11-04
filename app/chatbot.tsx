"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Bot, ChevronRight, LoaderCircle, MessageCircle, PackageSearch, RotateCcw, SendHorizontal, ShieldCheck, X } from "lucide-react";
import type { ChatMessage, ChatReply } from "./lib/chatbot-policy";
import { money } from "./catalog";
import styles from "./chatbot.module.css";

type Message = ChatMessage & { products?: ChatReply["products"] };
const suggestions = [
  { label: "Nebulizers", question: "Help me choose a nebulizer for home use." },
  { label: "BP monitors", question: "What should I check before buying a blood pressure machine?" },
  { label: "Sugar checkers", question: "Help me choose a glucometer and compatible sugar test strips." },
  { label: "اردو میں پوچھیں", question: "مجھے بلڈ پریشر مشین منتخب کرنے میں مدد دیں۔" },
];

export default function Chatbot() {
  const pathname = usePathname();
  const [open,setOpen] = useState(false);
  const [messages,setMessages] = useState<Message[]>([]);
  const [draft,setDraft] = useState("");
  const [pending,setPending] = useState("");
  const [error,setError] = useState("");
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const hidden = pathname.startsWith("/admin");

  useEffect(() => {
    if (!open || hidden) return;
    if (!pending) input.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); launcher.current?.focus(); }
    };
    document.addEventListener("keydown",escape);
    return () => document.removeEventListener("keydown",escape);
  },[open,hidden,pending]);
  useEffect(() => {
    if (open && log.current) log.current.scrollTop = log.current.scrollHeight;
  },[messages,pending,error,open]);
  useEffect(() => () => controller.current?.abort(),[]);

  function reset() {
    controller.current?.abort(); controller.current = null;
    setMessages([]); setPending(""); setDraft(""); setError("");
    input.current?.focus();
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || content.length > 1500 || controller.current) return;
    const request = new AbortController(); controller.current = request;
    const history: ChatMessage[] = [...messages.slice(-10).map(({role,content}) => ({role,content})),{role:"user",content}];
    setPending(content); setDraft(""); setError("");
    try {
      const response = await fetch("/api/v1/chat",{
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }), signal: AbortSignal.any([request.signal,AbortSignal.timeout(45000)]),
      });
      const reply = await response.json();
      if (!response.ok) throw new Error(reply.error || "The assistant is unavailable. Please try again.");
      if (typeof reply.answer !== "string" || !Array.isArray(reply.products)) throw new Error("We couldn't read that reply. Please try again.");
      if (controller.current !== request) return;
      setMessages(current => [...current.slice(-38),{role:"user",content},{role:"assistant",content:reply.answer,products:reply.products}]);
    } catch (reason) {
      if (controller.current !== request) return;
      setError(reason instanceof Error && reason.name !== "TimeoutError" && reason.name !== "AbortError" ? reason.message : "The reply took too long. Please try again.");
      setDraft(content);
    } finally {
      if (controller.current === request) { controller.current = null; setPending(""); input.current?.focus(); }
    }
  }

  if (hidden) return null;
  return <div className={styles.widget}>
    {!open && <a className={styles.whatsapp} href="https://wa.me/923310170118" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp at 03310170118" title="WhatsApp: 03310170118">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3A13 13 0 0 0 4.7 22.4L3 29l6.8-1.8A13 13 0 1 0 16 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M11 8.8c-.5-.2-1.1-.1-1.5.4-.9 1.1-1.3 2.3-.8 3.8 1.1 3.8 4.2 6.8 7.9 8.2 1.5.6 2.8.2 3.8-.8.4-.4.7-1.4.5-1.8-.2-.3-2.4-1.4-2.8-1.5-.4-.1-.7.2-1.3 1-.2.3-.4.4-.8.2-2.1-.9-3.7-2.4-4.6-4.3-.2-.4-.1-.6.2-.9.7-.7 1-1.1.8-1.5L11 8.8Z" fill="currentColor"/></svg>
    </a>}
    {open && <section id="store-chat-panel" className={styles.panel} role="dialog" aria-modal="false" aria-labelledby="store-chat-title">
      <header className={styles.header}>
        <span className={styles.avatar}><Bot size={24} strokeWidth={1.8}/></span>
        <div className={styles.heading}><h2 id="store-chat-title">Northstar assistant</h2><p>AI equipment shopping guide</p></div>
        <button type="button" className={styles.headerButton} aria-label="Start a new chat" title="Start a new chat" onClick={reset}><RotateCcw size={17}/></button>
        <button type="button" className={styles.headerButton} aria-label="Close chat" onClick={() => { setOpen(false); launcher.current?.focus(); }}><X size={20}/></button>
      </header>
      <div className={styles.languages}><span className={styles.statusDot}/>Here to help you choose<span>EN · اردو · Roman Urdu</span></div>
      <div ref={log} className={styles.conversation} role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions text" aria-busy={Boolean(pending)}>
        <div className={styles.intro}><span><PackageSearch size={25} strokeWidth={1.6}/></span><h3>Equipment, made simpler.</h3><p>Assalam-o-Alaikum! Looking for a nebulizer, BP monitor or sugar checker? I can help you compare options and find the right questions to ask.</p><p className={styles.urdu} lang="ur" dir="rtl">آپ اردو یا رومن اردو میں بھی سوال کر سکتے ہیں۔</p></div>
        {!messages.length && !pending && <div className={styles.suggestions}>{suggestions.map(suggestion => <button key={suggestion.label} type="button" onClick={() => void send(suggestion.question)}>{suggestion.label}<ChevronRight size={13}/></button>)}</div>}
        {messages.map((message,index) => <div key={index} className={`${styles.message} ${message.role === "user" ? styles.user : styles.assistant}`}>
          <span className={styles.speaker}>{message.role === "user" ? "You" : "Northstar AI"}</span><p dir="auto">{message.content}</p>
          {message.products && message.products.length > 0 && <div className={styles.products}>{message.products.map(product => <Link key={product.id} href={product.href} className={styles.product} onClick={() => setOpen(false)}><div><strong>{product.name}</strong><small>{money(product.price)} · {product.available ? "In stock" : "Out of stock"}</small></div><ChevronRight size={17}/></Link>)}</div>}
        </div>)}
        {pending && <><div className={`${styles.message} ${styles.user}`}><span className={styles.speaker}>You</span><p dir="auto">{pending}</p></div><div className={styles.typing}><LoaderCircle size={15} className={styles.spinner}/><span>Checking your question…</span></div></>}
        {error && <div className={styles.error} role="alert"><AlertCircle size={17}/><div>{error}<small>Your message is below. You can edit it and send again.</small></div></div>}
      </div>
      <div className={styles.safety}><ShieldCheck size={14}/><span>Shopping guidance, not diagnosis or treatment.</span></div>
      <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(draft); }}>
        <label className={styles.srOnly} htmlFor="store-chat-input">Your equipment question</label>
        <textarea ref={input} id="store-chat-input" dir="auto" rows={2} maxLength={1500} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask about equipment… / اپنا سوال لکھیں" disabled={Boolean(pending)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); } }}/>
        <button type="submit" className={styles.send} aria-label="Send message" disabled={!draft.trim() || Boolean(pending)}><SendHorizontal size={19}/></button>
      </form>
      <footer className={styles.footer}><span>Messages go to Google Gemini. Avoid private health or bank details.</span><div><Link href="/#products" onClick={() => setOpen(false)}>Browse store</Link><span>·</span><Link href="/account" onClick={() => setOpen(false)}>Order help</Link><small>{draft.length}/1500</small></div></footer>
    </section>}
    <button ref={launcher} type="button" className={`${styles.launcher} ${open ? styles.open : ""}`} aria-label={open ? "Close equipment assistant" : "Open equipment assistant"} aria-expanded={open} aria-controls="store-chat-panel" onClick={() => setOpen(value => !value)}>{open ? <X size={24}/> : <MessageCircle size={27} strokeWidth={1.8}/>}<span className={styles.launcherLabel}>Ask us</span>{!open && <i/>}</button>
  </div>;
}
