import type { AuthorizedUser } from "@/lib/auth/authorization";
import { assertMasterDataAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseCommand } from "@/lib/validation/command";
import { normalizeOptionalText, normalizeSku } from "@/lib/validation/normalization";
import { translatePrismaError } from "@/lib/validation/prisma-errors";

import {
  normalizeSpecifications,
  parseNonnegativeDecimal,
  productCommandSchema,
  type ProductCommand,
} from "./validation";

async function validateReferences(command: ProductCommand) {
  const [category, unit, supplier] = await Promise.all([
    prisma.category.findUnique({ where: { id: command.categoryId }, select: { isActive: true } }),
    prisma.unitOfMeasure.findUnique({
      where: { id: command.inventoryUnitId },
      select: { isActive: true, decimalScale: true },
    }),
    command.preferredSupplierId
      ? prisma.supplier.findUnique({
          where: { id: command.preferredSupplierId },
          select: { isActive: true },
        })
      : Promise.resolve(null),
  ]);
  if (!category?.isActive) {
    throw new ApplicationError("VALIDATION_ERROR", "Select an active category");
  }
  if (!unit?.isActive) {
    throw new ApplicationError("VALIDATION_ERROR", "Select an active unit of measurement");
  }
  if (command.preferredSupplierId && !supplier?.isActive) {
    throw new ApplicationError("VALIDATION_ERROR", "Select an active preferred supplier");
  }
  return unit;
}

async function productData(input: ProductCommand) {
  const command = parseCommand(productCommandSchema, input);
  const unit = await validateReferences(command);
  const lowStockThreshold = parseNonnegativeDecimal(
    command.lowStockThreshold,
    "Low-stock threshold",
    unit.decimalScale,
  );
  if (lowStockThreshold === null) {
    throw new ApplicationError("VALIDATION_ERROR", "Low-stock threshold is required");
  }
  return {
    sku: normalizeSku(command.sku),
    name: command.name.trim(),
    description: normalizeOptionalText(command.description),
    categoryId: command.categoryId,
    inventoryUnitId: command.inventoryUnitId,
    preferredSupplierId: command.preferredSupplierId ?? null,
    defaultPurchasePrice: parseNonnegativeDecimal(
      command.defaultPurchasePrice,
      "Default purchase price",
      4,
    ),
    defaultSellingPrice: parseNonnegativeDecimal(
      command.defaultSellingPrice,
      "Default selling price",
      4,
    ),
    lowStockThreshold,
    specifications: normalizeSpecifications(command.specifications),
  };
}

export async function createProduct(input: ProductCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  try {
    return await prisma.product.create({ data: await productData(input) });
  } catch (error) {
    translatePrismaError(error, "A product with this SKU already exists");
  }
}

export async function updateProduct(id: string, input: ProductCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  try {
    return await prisma.product.update({ where: { id }, data: await productData(input) });
  } catch (error) {
    translatePrismaError(error, "A product with this SKU already exists");
  }
}

export async function setProductActive(id: string, isActive: boolean, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  try {
    return await prisma.product.update({ where: { id }, data: { isActive } });
  } catch (error) {
    translatePrismaError(error, "Product status could not be changed");
  }
}
