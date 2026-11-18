export const FREE_DELIVERY_THRESHOLD_MINOR = 1_500_000;

export function shippingMinor(subtotalMinor: number) {
  return subtotalMinor >= FREE_DELIVERY_THRESHOLD_MINOR ? 0 : 65_000;
}
