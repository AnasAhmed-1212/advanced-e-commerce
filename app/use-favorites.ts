"use client";

import { useMemo, useSyncExternalStore } from "react";
import { UUID_PATTERN } from "./lib/catalog-types";

const key = "northstar-favorites", event = "northstar-favorites-changed";
let fallback = "[]", memoryOnly = false;
function snapshot() { try { return memoryOnly ? fallback : localStorage.getItem(key) || "[]"; } catch { return fallback; } }
function read(raw: string): string[] { try { const value = JSON.parse(raw); return Array.isArray(value) ? [...new Set(value.filter((id: unknown): id is string => typeof id === "string" && UUID_PATTERN.test(id)))].slice(0,500) : []; } catch { return []; } }
function subscribe(callback: () => void) { window.addEventListener(event,callback); window.addEventListener("storage",callback); return () => { window.removeEventListener(event,callback); window.removeEventListener("storage",callback); }; }
function toggleSaved(id: string) {
  const current = read(snapshot());
  fallback = JSON.stringify(current.includes(id) ? current.filter(value => value !== id) : [...current,id]);
  try { localStorage.setItem(key,fallback); memoryOnly = false; } catch { memoryOnly = true; }
  window.dispatchEvent(new Event(event));
}
export function useFavorites() {
  const raw = useSyncExternalStore(subscribe,snapshot,() => "[]");
  return { favorites: useMemo(() => read(raw),[raw]), toggleSaved };
}
