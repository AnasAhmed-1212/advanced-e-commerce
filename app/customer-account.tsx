"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Account = {
  configured: boolean;
  authenticated: boolean;
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null } | null;
  orders: { id: string; orderNumber: string; fulfillmentStatus: string; paymentStatus: string; totalMinor: number; createdAt: string }[];
};

const AccountContext = createContext<{ account: Account | null; error: string; refresh: () => Promise<void> } | null>(null);

export function CustomerAccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const requestNumber = useRef(0);
  const refresh = useCallback((signal?: AbortSignal) => {
    const request = ++requestNumber.current;
    const isCurrent = () => !signal?.aborted && request === requestNumber.current;
    return fetch("/api/v1/account/session", { cache: "no-store", signal })
      .then(async response => {
        if (!response.ok) throw new Error("Unable to load your account.");
        const data: Account = await response.json();
        if (isCurrent()) {
          setAccount(data);
          setError("");
        }
      })
      .catch(() => {
        if (isCurrent()) setError("Unable to load your account. Please try again.");
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const refreshOnFocus = () => { void refresh(controller.signal); };
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [refresh]);

  return <AccountContext.Provider value={{ account, error, refresh }}>{children}</AccountContext.Provider>;
}

export function useCustomerAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("CustomerAccountProvider is missing.");
  return context;
}
