"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { UUID_PATTERN } from "./lib/catalog-types";
import { isStorefrontPath, type ActivityKind } from "./lib/storefront-activity";

const visitorKey = "medgearbridge-visitor";
let visitorId: string | undefined;

function getVisitorId() {
  if (visitorId) return visitorId;
  if (!window.crypto?.randomUUID) return;
  visitorId = window.crypto.randomUUID();
  try {
    const saved = window.localStorage.getItem(visitorKey);
    if (saved && UUID_PATTERN.test(saved)) visitorId = saved;
    else window.localStorage.setItem(visitorKey, visitorId);
  } catch {
    // The current page can still track activity if browser storage is unavailable.
  }
  return visitorId;
}

export function trackStoreActivity(kind: ActivityKind | "heartbeat", destination?: string) {
  if (!isStorefrontPath(window.location.pathname)) return;
  const path = destination ?? window.location.pathname;
  if (!isStorefrontPath(path)) return;
  const id = getVisitorId();
  if (!id) return;
  void fetch("/api/v1/storefront/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId: id, kind, path }),
    keepalive: true,
  }).catch(() => {});
}

export default function StorefrontTracker() {
  const path = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const changed = lastPath.current !== path;
    lastPath.current = path;
    if (!path || !isStorefrontPath(path)) return;
    if (changed) trackStoreActivity("page_view", path);
    const heartbeat = () => {
      if (document.visibilityState === "visible") trackStoreActivity("heartbeat", path);
    };
    const timer = window.setInterval(heartbeat, 60_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [path]);

  return null;
}
