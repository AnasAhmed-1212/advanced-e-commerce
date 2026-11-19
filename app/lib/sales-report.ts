export const saleRanges = [7, 30, 90, 365, 0] as const;
export type SaleRange = typeof saleRanges[number];

export type SalesAmounts = {
  orders: number;
  soldUnits: number;
  pendingUnits: number;
  reversedUnits: number;
  salesMinor: number;
  collectedMinor: number;
  openMinor: number;
  costMinor: number;
  profitMinor: number | null;
  missingCostUnits: number;
};

export type SalesReport = {
  summary: SalesAmounts;
  trend: (Pick<SalesAmounts, "salesMinor" | "profitMinor" | "soldUnits" | "pendingUnits"> & { date: string })[];
  statuses: { sold: number; pending: number; cancelled: number; returned: number; refunded: number };
  products: (Pick<SalesAmounts, "soldUnits" | "pendingUnits" | "reversedUnits" | "salesMinor" | "profitMinor" | "missingCostUnits"> & { key: string; title: string })[];
  ledger: (Omit<SalesAmounts, "orders" | "collectedMinor" | "openMinor"> & {
    id: string; number: string; date: string; payment: string; fulfillment: string; status: keyof SalesReport["statuses"];
    totalMinor: number; shippingMinor: number; taxMinor: number;
  })[];
  hasMore: boolean;
};
