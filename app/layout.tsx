import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "./cart-context";

export const metadata: Metadata = {
  title: "Northstar — Thoughtful everyday essentials",
  description: "Discover thoughtfully selected technology, home, workspace, and travel essentials.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" data-scroll-behavior="smooth"><body><CartProvider>{children}</CartProvider></body></html>;
}
