import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "./cart-context";
import { Suspense } from "react";
import Chatbot from "./chatbot";
import { STORE_NAME } from "./lib/brand";

export const metadata: Metadata = {
  title: `${STORE_NAME} — Thoughtful everyday essentials`,
  description: "Discover thoughtfully selected technology, home, workspace, and travel essentials.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Browser extensions can add attributes to the body before React hydrates.
  return <html lang="en" data-scroll-behavior="smooth"><body suppressHydrationWarning><CartProvider>{children}</CartProvider><Suspense fallback={null}><Chatbot/></Suspense></body></html>;
}
