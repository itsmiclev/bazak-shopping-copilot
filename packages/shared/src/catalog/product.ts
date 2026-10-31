import { z } from "zod";

export const CATALOG_CURRENCY = "USD";
export const CurrencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code.")
  .transform((code) => code.toUpperCase());
export const ProductSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string(),
  description: z.string(),
  price: z.number().finite().nonnegative(),
  currency: CurrencyCodeSchema.default(CATALOG_CURRENCY),
  thumbnail: z.string(),
  category: z.string(),
  rating: z.number().finite().optional(),
  score: z.number().finite().optional(),
  confidence: z.number().finite().optional(),
});

// Older persisted cards omit currency; parsing fills the catalog currency.
export type Product = z.input<typeof ProductSchema>;
