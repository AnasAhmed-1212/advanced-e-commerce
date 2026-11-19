import type { Metadata } from "next";
import "./globals.css";
import { CustomerAccountProvider } from "./customer-account";
import CartDrawer from "./cart-drawer";
import { CartProvider } from "./cart-context";
import { Suspense } from "react";
import Chatbot from "./chatbot";
import StorefrontTracker from "./storefront-tracker";
import { STORE_NAME } from "./lib/brand";

export const metadata: Metadata = {
  title: `${STORE_NAME} — Thoughtful everyday essentials`,
  description: "Discover thoughtfully selected technology, home, workspace, and travel essentials.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Browser extensions can add attributes to the body before React hydrates.
  return <html lang="en" data-scroll-behavior="smooth"><body suppressHydrationWarning><CustomerAccountProvider><CartProvider>{children}<CartDrawer/></CartProvider></CustomerAccountProvider><Suspense fallback={null}><Chatbot/><StorefrontTracker/></Suspense></body></html>;
}
