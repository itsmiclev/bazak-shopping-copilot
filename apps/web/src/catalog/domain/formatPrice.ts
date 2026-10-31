import { CATALOG_CURRENCY } from "@bazak/shared";

/** Format the catalog amount in its own currency; this never converts prices. */
export function formatPrice(
  amount: number,
  currency = CATALOG_CURRENCY,
  locale = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}
