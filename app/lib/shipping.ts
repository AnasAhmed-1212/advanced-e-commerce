export const DEFAULT_DELIVERY_CHARGE_MINOR = 65_000;

// Cart lines contain distinct products. Each product's delivery charge applies once.
export function shippingMinor(lines: readonly { deliveryChargeMinor: number }[]) {
  return lines.reduce((sum, line) => sum + line.deliveryChargeMinor, 0);
}
