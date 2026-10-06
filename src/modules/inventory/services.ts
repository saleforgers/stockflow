import { z } from "zod";
import Decimal from "decimal.js";
import { assertOperationalWriter, type AuthorizedUser } from "@/lib/auth/authorization";
import { parseCommand } from "@/lib/validation/command";
import { parseBusinessDate } from "@/lib/validation/business-date";
import { decimal, validateQuantity } from "@/lib/decimal/decimal";
import { nextDocumentNumber } from "@/lib/db/document-number";
import { ApplicationError } from "@/lib/errors/application-error";
import { fifoPlan } from "@/modules/sales/calculations";
import { salesTransaction } from "@/modules/sales/transaction";
const quantity = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/)
  .max(22);
export const adjustmentSchema = z.object({
  requestKey: z.string().uuid(),
  productId: z.string().uuid(),
  currentQuantity: quantity,
  actualQuantity: quantity,
  unitCost: quantity.optional(),
  date: z.string().min(1),
  reason: z.enum(["Damage", "Loss", "Count Correction", "Opening Stock", "Other"]),
  notes: z.string().trim().max(2000).optional(),
});
export type AdjustmentCommand = z.infer<typeof adjustmentSchema>;
export async function adjustStock(input: AdjustmentCommand, actor: AuthorizedUser) {
  assertOperationalWriter(actor);
  const c = parseCommand(adjustmentSchema, input);
  return salesTransaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c.requestKey},0))::text`;
    const replay = await tx.stockAdjustment.findUnique({
      where: { requestKey: c.requestKey },
      include: { lines: true },
    });
    if (replay) {
      if (replay.lines[0]?.productId !== c.productId)
        throw new ApplicationError("CONFLICT", "Adjustment request already used");
      return replay;
    }
    const product = await tx.product.findUnique({
      where: { id: c.productId },
      include: { inventoryUnit: true },
    });
    const location = await tx.inventoryLocation.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (!product?.isActive || !product.inventoryUnit.isActive || !location)
      throw new ApplicationError("VALIDATION_ERROR", "Select an active product");
    // Stable lot lock order matches invoice posting. Serializable retry also covers new inbound layers.
    await tx.$queryRaw`SELECT id FROM "InventoryLot" WHERE "productId"=${c.productId}::uuid AND "locationId"=${location.id}::uuid ORDER BY id FOR UPDATE`;
    const movements = await tx.stockMovement.groupBy({
      by: ["direction"],
      where: { productId: c.productId, locationId: location.id },
      _sum: { quantity: true },
    });
    const current = movements.reduce(
      (s, m) =>
        m.direction === "IN"
          ? s.plus(m._sum.quantity?.toString() ?? "0")
          : s.minus(m._sum.quantity?.toString() ?? "0"),
      new Decimal(0),
    );
    const lots = await tx.inventoryLot.findMany({
      where: { productId: c.productId, locationId: location.id },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    });
    const layerQuantity = lots.reduce(
      (s, l) => s.plus(l.availableQuantity.toString()),
      new Decimal(0),
    );
    if (!layerQuantity.equals(current))
      throw new ApplicationError(
        "INVARIANT_VIOLATION",
        "Stock history and lots do not reconcile. Contact your administrator.",
      );
    if (!current.equals(c.currentQuantity))
      throw new ApplicationError(
        "CONFLICT",
        "Stock has changed. Refresh this page and check the actual count again.",
      );
    const actual = decimal(c.actualQuantity);
    if (actual.gt(0)) validateQuantity(actual, product.inventoryUnit.decimalScale);
    const difference = actual.minus(current);
    if (difference.isZero())
      throw new ApplicationError("VALIDATION_ERROR", "The actual quantity is unchanged");
    if ((c.reason === "Damage" || c.reason === "Loss") && difference.gt(0))
      throw new ApplicationError("VALIDATION_ERROR", "Damage and loss must reduce stock");
    if (c.reason === "Opening Stock" && (current.gt(0) || lots.length > 0))
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Opening stock is only allowed before this product has stock history",
      );
    const date = parseBusinessDate(c.date, "Adjustment date");
    const adjustment = await tx.stockAdjustment.create({
      data: {
        requestKey: c.requestKey,
        adjustmentNumber: await nextDocumentNumber(tx, "stockAdjustment"),
        adjustmentDate: date,
        reason: c.reason,
        notes: c.notes || null,
        createdById: actor.id,
      },
    });
    const movementType =
      c.reason === "Damage"
        ? "DAMAGED"
        : c.reason === "Loss"
          ? "LOST"
          : c.reason === "Opening Stock"
            ? "OPENING_STOCK"
            : "STOCK_ADJUSTMENT";
    let plan: { lot: (typeof lots)[number]; quantity: Decimal }[];
    if (difference.gt(0)) {
      const cost = decimal(c.unitCost ?? "0");
      if (!cost.isFinite() || cost.lte(0) || cost.decimalPlaces() > 4)
        throw new ApplicationError(
          "VALIDATION_ERROR",
          "Added stock needs a positive approved unit cost with at most 4 decimals",
        );
      const lot = await tx.inventoryLot.create({
        data: {
          origin: c.reason === "Opening Stock" ? "OPENING" : "ADJUSTMENT",
          productId: product.id,
          locationId: location.id,
          originalQuantity: difference.toFixed(),
          availableQuantity: difference.toFixed(),
          unitCost: cost.toFixed(),
          receivedAt: date,
        },
      });
      plan = [{ lot, quantity: difference }];
    } else {
      plan = fifoPlan(
        lots.filter((l) => l.status === "OPEN"),
        difference.abs(),
      );
      for (const item of plan) {
        const remaining = decimal(item.lot.availableQuantity).minus(item.quantity);
        await tx.inventoryLot.update({
          where: { id: item.lot.id },
          data: {
            availableQuantity: remaining.toFixed(),
            status: remaining.isZero() ? "DEPLETED" : "OPEN",
            closedAt: remaining.isZero() ? new Date() : null,
          },
        });
      }
    }
    for (const item of plan) {
      const line = await tx.stockAdjustmentLine.create({
        data: {
          stockAdjustmentId: adjustment.id,
          productId: product.id,
          locationId: location.id,
          inventoryLotId: item.lot.id,
          movementType,
          direction: difference.gt(0) ? "IN" : "OUT",
          quantity: item.quantity.toFixed(),
          unitCost: item.lot.unitCost,
          reason: c.reason,
        },
      });
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          locationId: location.id,
          inventoryLotId: item.lot.id,
          direction: line.direction,
          movementType,
          quantity: line.quantity,
          unitCostSnapshot: item.lot.unitCost,
          occurredAt: new Date(),
          reason: c.reason,
          notes: c.notes || null,
          adjustmentLineId: line.id,
          createdById: actor.id,
        },
      });
    }
    return tx.stockAdjustment.update({
      where: { id: adjustment.id },
      data: { status: "POSTED", postedAt: new Date() },
    });
  });
}
