import Decimal from "decimal.js";
import { z } from "zod";

import { ApplicationError } from "@/lib/errors/application-error";

export interface SpecificationRow {
  readonly key: string;
  readonly value: string;
}

const optionalId = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().uuid().nullable().optional(),
);

export const productCommandSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9 _./-]+$/),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().uuid(),
  inventoryUnitId: z.string().uuid(),
  preferredSupplierId: optionalId,
  defaultPurchasePrice: z.string().trim().nullable().optional(),
  defaultSellingPrice: z.string().trim().nullable().optional(),
  openingStockQuantity: z.string().trim().optional(),
  lowStockThreshold: z.string().trim().min(1),
  specifications: z.array(
    z.object({ key: z.string().trim().max(50), value: z.string().trim().max(300) }),
  ),
});

export type ProductCommand = z.infer<typeof productCommandSchema>;

export function parseNonnegativeDecimal(
  value: string | null | undefined,
  label: string,
  maximumScale: number,
): string | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  let amount: Decimal;
  try {
    amount = new Decimal(value);
  } catch {
    throw new ApplicationError("VALIDATION_ERROR", `${label} must be a valid decimal`);
  }
  if (!amount.isFinite() || amount.isNegative()) {
    throw new ApplicationError("VALIDATION_ERROR", `${label} cannot be negative`);
  }
  if (amount.decimalPlaces() > maximumScale) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      `${label} allows at most ${maximumScale} decimal places`,
    );
  }
  if (amount.greaterThan("99999999999999.9999")) {
    throw new ApplicationError("VALIDATION_ERROR", `${label} is too large`);
  }
  return amount.toFixed();
}

export function normalizeSpecifications(rows: readonly SpecificationRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    const rawKey = row.key.trim();
    const value = row.value.trim();
    if (!rawKey && !value) continue;
    if (!rawKey || !value) {
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Every product specification needs both an attribute and a value",
      );
    }
    const key = rawKey
      .toLowerCase()
      .normalize("NFKD")
      .replaceAll(/[\u0300-\u036f]/g, "")
      .replaceAll(/[^a-z0-9]+/g, "_")
      .replaceAll(/^_|_$/g, "");
    if (!key) {
      throw new ApplicationError("VALIDATION_ERROR", "Specification attribute is invalid");
    }
    if (Object.hasOwn(result, key)) {
      throw new ApplicationError("VALIDATION_ERROR", `Duplicate specification attribute: ${key}`);
    }
    result[key] = value;
  }
  return result;
}
