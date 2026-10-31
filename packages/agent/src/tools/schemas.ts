import { z } from "zod";
import {
  AttributeFilterSchema,
  CurrencyCodeSchema,
  CATALOG_CURRENCY,
} from "@bazak/shared";
import { categories } from "../domain/catalog/categories.js";
export const currencyField = CurrencyCodeSchema.default(CATALOG_CURRENCY);
export const attributeFields = {
  attributes: z.array(AttributeFilterSchema).max(6).optional(),
};
export const priceFields = {
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  sort: z.enum(["relevance", "price-asc", "price-desc"]).optional(),
  currency: currencyField,
};
export const brandAndPriceFields = {
  brand: z.string().min(1).max(100).optional(),
  ...priceFields,
};
export const paginationFields = {
  skip: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(20).optional(),
};
export const categoryField = z.enum(categories as [string, ...string[]]);
export const categoriesField = z
  .array(categoryField)
  .min(1)
  .max(3)
  .refine(
    (values) => new Set(values).size === values.length,
    "Choose distinct categories.",
  );
