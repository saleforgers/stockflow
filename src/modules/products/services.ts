import Decimal from "decimal.js";

import type { Prisma } from "@/generated/prisma/client";
import type { AuthorizedUser } from "@/lib/auth/authorization";
import { assertMasterDataAdmin } from "@/lib/auth/authorization";
import { nextDocumentNumber } from "@/lib/db/document-number";
import { prisma } from "@/lib/db/prisma";
import { runInBusinessTransaction } from "@/lib/db/transaction";
import { ApplicationError } from "@/lib/errors/application-error";
import { currentBusinessDate } from "@/lib/format";
import { parseBusinessDate } from "@/lib/validation/business-date";
import { parseCommand } from "@/lib/validation/command";
import { normalizeOptionalText, normalizeSku } from "@/lib/validation/normalization";
import { translatePrismaError } from "@/lib/validation/prisma-errors";

import {
  normalizeSpecifications,
  parseNonnegativeDecimal,
  productCommandSchema,
  type ProductCommand,
} from "./validation";

type ProductDatabase = Pick<Prisma.TransactionClient, "category" | "unitOfMeasure" | "supplier">;

async function validateReferences(command: ProductCommand, database: ProductDatabase) {
  const category = await database.category.findUnique({
    where: { id: command.categoryId },
    select: { isActive: true },
  });
  const unit = await database.unitOfMeasure.findUnique({
    where: { id: command.inventoryUnitId },
    select: { isActive: true, decimalScale: true },
  });
  const supplier = command.preferredSupplierId
    ? await database.supplier.findUnique({
        where: { id: command.preferredSupplierId },
        select: { isActive: true },
      })
    : null;
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

async function productData(input: ProductCommand, database: ProductDatabase) {
  const command = parseCommand(productCommandSchema, input);
  const unit = await validateReferences(command, database);
  const lowStockThreshold = parseNonnegativeDecimal(
    command.lowStockThreshold,
    "Low-stock threshold",
    unit.decimalScale,
  );
  if (lowStockThreshold === null) {
    throw new ApplicationError("VALIDATION_ERROR", "Low-stock threshold is required");
  }
  const defaultPurchasePrice = parseNonnegativeDecimal(
    command.defaultPurchasePrice,
    "Default purchase price",
    4,
  );
  const openingStockQuantity =
    parseNonnegativeDecimal(
      command.openingStockQuantity ?? "0",
      "Opening stock quantity",
      unit.decimalScale,
    ) ?? "0";
  return {
    data: {
      sku: normalizeSku(command.sku),
      name: command.name.trim(),
      description: normalizeOptionalText(command.description),
      categoryId: command.categoryId,
      inventoryUnitId: command.inventoryUnitId,
      preferredSupplierId: command.preferredSupplierId ?? null,
      defaultPurchasePrice,
      defaultSellingPrice: parseNonnegativeDecimal(
        command.defaultSellingPrice,
        "Default selling price",
        4,
      ),
      lowStockThreshold,
      specifications: normalizeSpecifications(command.specifications),
    },
    openingStockQuantity,
  };
}

export async function createProduct(input: ProductCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  try {
    return await runInBusinessTransaction(prisma, async (transaction) => {
      const prepared = await productData(input, transaction);
      const openingQuantity = new Decimal(prepared.openingStockQuantity);
      if (
        openingQuantity.greaterThan(0) &&
        (!prepared.data.defaultPurchasePrice ||
          new Decimal(prepared.data.defaultPurchasePrice).lessThanOrEqualTo(0))
      ) {
        throw new ApplicationError(
          "VALIDATION_ERROR",
          "Opening stock requires a positive Default Purchase Price to use as its unit cost",
        );
      }

      const product = await transaction.product.create({ data: prepared.data });
      if (openingQuantity.isZero()) return product;

      const location = await transaction.inventoryLocation.findFirst({
        where: { isDefault: true, isActive: true },
        select: { id: true },
      });
      if (!location) {
        throw new ApplicationError(
          "INVARIANT_VIOLATION",
          "An active default inventory location is required for opening stock",
        );
      }

      const now = new Date();
      const unitCost = prepared.data.defaultPurchasePrice!;
      const adjustment = await transaction.stockAdjustment.create({
        data: {
          adjustmentNumber: await nextDocumentNumber(transaction, "stockAdjustment"),
          adjustmentDate: parseBusinessDate(currentBusinessDate(), "Opening stock date"),
          reason: "Opening Stock",
          notes: "Opening stock recorded when the product was created.",
          createdById: actor.id,
        },
      });
      const lot = await transaction.inventoryLot.create({
        data: {
          origin: "OPENING",
          productId: product.id,
          locationId: location.id,
          originalQuantity: openingQuantity.toFixed(),
          availableQuantity: openingQuantity.toFixed(),
          unitCost,
          receivedAt: now,
        },
      });
      const line = await transaction.stockAdjustmentLine.create({
        data: {
          stockAdjustmentId: adjustment.id,
          productId: product.id,
          locationId: location.id,
          inventoryLotId: lot.id,
          movementType: "OPENING_STOCK",
          direction: "IN",
          quantity: openingQuantity.toFixed(),
          unitCost,
          reason: "Opening Stock",
        },
      });
      await transaction.stockMovement.create({
        data: {
          productId: product.id,
          locationId: location.id,
          inventoryLotId: lot.id,
          direction: "IN",
          movementType: "OPENING_STOCK",
          quantity: openingQuantity.toFixed(),
          unitCostSnapshot: unitCost,
          occurredAt: now,
          reason: "Opening Stock",
          notes: "Opening stock recorded when the product was created.",
          adjustmentLineId: line.id,
          createdById: actor.id,
        },
      });
      await transaction.stockAdjustment.update({
        where: { id: adjustment.id },
        data: { status: "POSTED", postedAt: now },
      });
      return product;
    });
  } catch (error) {
    translatePrismaError(error, "A product with this SKU already exists");
  }
}

export async function updateProduct(id: string, input: ProductCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  try {
    const prepared = await productData(input, prisma);
    if (new Decimal(prepared.openingStockQuantity).greaterThan(0)) {
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Opening stock can only be entered when a product is first created. Use Adjust Stock instead.",
      );
    }
    return await prisma.product.update({ where: { id }, data: prepared.data });
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
