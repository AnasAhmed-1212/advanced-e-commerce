export const activityLabels = {
  page_view: "Page viewed",
  add_to_cart: "Added to cart",
  checkout_started: "Checkout started",
  order_placed: "Order placed",
  account_registered: "Account created",
  signed_in: "Signed in",
  signed_out: "Signed out",
} as const;

export type ActivityKind = keyof typeof activityLabels;

export function isStorefrontPath(path: string) {
  return path === "/" || path === "/account" || path === "/checkout" ||
    /^\/products\/[a-z0-9](?:[a-z0-9-]{0,119})$/.test(path);
}

export type VisitorReport = {
  active: number;
  today: number;
  total: number;
  hasMore: boolean;
  activity: { id: string; visitorId: string; kind: ActivityKind; path: string; occurredAt: string }[];
};
