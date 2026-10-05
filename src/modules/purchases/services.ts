import Decimal from "decimal.js";
import type { AuthorizedUser } from "@/lib/auth/authorization";
import { assertOperationalWriter } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { nextDocumentNumber } from "@/lib/db/document-number";
import { runInBusinessTransaction, type BusinessTransaction } from "@/lib/db/transaction";
import { decimal, roundMoney, validateQuantity } from "@/lib/decimal/decimal";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseBusinessDate, parseInstant } from "@/lib/validation/business-date";
import { parseCommand } from "@/lib/validation/command";
import { parseIdentifier } from "@/lib/validation/identifier";
import { normalizeOptionalText } from "@/lib/validation/normalization";
import { nonnegativeMoney, paymentStatus, positiveMoney, purchaseLineAmount } from "./calculations";
import {
  purchaseDraftCommandSchema,
  purchasePostingPaymentSchema,
  purchaseReturnCommandSchema,
  supplierPaymentCommandSchema,
  type PurchaseDraftCommand,
  type PurchasePostingPayment,
  type PurchaseReturnCommand,
  type SupplierPaymentCommand,
} from "./validation";

type PreparedLine = {
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  uomCodeSnapshot: string;
  quantity: string;
  unitPurchasePrice: string;
  grossAmount: string;
  lineDiscountAmount: string;
  unitCost: string;
  lineTotal: string;
  notes: string | null;
};

type PreparedLot = {
  id?: string;
  supplierLotReference: string | null;
  receivedAt: Date;
  notes: string | null;
  lines: PreparedLine[];
};

async function prepareDraft(transaction: BusinessTransaction, input: PurchaseDraftCommand) {
  const command = parseCommand(purchaseDraftCommandSchema, input);
  const supplier = await transaction.supplier.findUnique({ where: { id: command.supplierId } });
  if (!supplier?.isActive) {
    throw new ApplicationError("VALIDATION_ERROR", "Select an active supplier");
  }

  const productIds = [
    ...new Set(command.lots.flatMap((lot) => lot.lines.map((line) => line.productId))),
  ];
  const products = await transaction.product.findMany({
    where: { id: { in: productIds } },
    include: { inventoryUnit: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));
  if (
    products.length !== productIds.length ||
    products.some((product) => !product.isActive || !product.inventoryUnit.isActive)
  ) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "Every purchase line must use an active product and unit",
    );
  }

  let subtotal = new Decimal(0);
  const lots: PreparedLot[] = command.lots.map((lot) => ({
    ...(lot.id ? { id: lot.id } : {}),
    supplierLotReference: normalizeOptionalText(lot.supplierLotReference),
    receivedAt: parseInstant(lot.receivedAt, "Received date and time"),
    notes: normalizeOptionalText(lot.notes),
    lines: lot.lines.map((line) => {
      const product = productById.get(line.productId);
      if (!product) throw new ApplicationError("VALIDATION_ERROR", "Select an active product");
      const calculated = purchaseLineAmount(
        line.quantity,
        line.unitCost,
        product.inventoryUnit.decimalScale,
        line.lineDiscountAmount,
      );
      subtotal = subtotal.plus(calculated.lineTotal);
      return {
        productId: product.id,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        uomCodeSnapshot: product.inventoryUnit.code,
        quantity: calculated.quantity.toFixed(),
        unitPurchasePrice: calculated.unitPurchasePrice.toFixed(),
        grossAmount: calculated.grossAmount.toFixed(2),
        lineDiscountAmount: calculated.lineDiscountAmount.toFixed(2),
        unitCost: calculated.unitCost.toFixed(),
        lineTotal: calculated.lineTotal.toFixed(2),
        notes: normalizeOptionalText(line.notes),
      };
    }),
  }));
  const additionalCharges = nonnegativeMoney(command.additionalCharges, "Additional charges");
  return {
    command,
    supplier,
    lots,
    purchaseDate: parseBusinessDate(command.purchaseDate, "Purchase date"),
    subtotal: subtotal.toFixed(2),
    additionalCharges: additionalCharges.toFixed(2),
    totalAmount: subtotal.plus(additionalCharges).toFixed(2),
  };
}

async function defaultLocation(transaction: BusinessTransaction) {
  const location = await transaction.inventoryLocation.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { id: "asc" },
  });
  if (!location) {
    throw new ApplicationError(
      "INVARIANT_VIOLATION",
      "The active default inventory location is missing",
    );
  }
  return location;
}

async function createPreparedLots(
  transaction: BusinessTransaction,
  purchaseId: string,
  actorId: string,
  lots: PreparedLot[],
) {
  for (const lot of lots) {
    const purchaseLot = lot.id
      ? await transaction.purchaseLot.update({
          where: { id: lot.id },
          data: {
            supplierLotReference: lot.supplierLotReference,
            receivedAt: lot.receivedAt,
            notes: lot.notes,
          },
        })
      : await transaction.purchaseLot.create({
          data: {
            lotNumber: await nextDocumentNumber(transaction, "purchaseLot"),
            purchaseId,
            supplierLotReference: lot.supplierLotReference,
            receivedAt: lot.receivedAt,
            notes: lot.notes,
            createdById: actorId,
          },
        });
    await transaction.purchaseLine.createMany({
      data: lot.lines.map((line) => ({ ...line, purchaseId, purchaseLotId: purchaseLot.id })),
    });
  }
}

export async function createPurchaseDraft(input: PurchaseDraftCommand, actor: AuthorizedUser) {
  assertOperationalWriter(actor);
  return runInBusinessTransaction(prisma, async (transaction) => {
    const prepared = await prepareDraft(transaction, input);
    const location = await defaultLocation(transaction);
    const purchase = await transaction.purchase.create({
      data: {
        purchaseNumber: await nextDocumentNumber(transaction, "purchase"),
        supplierId: prepared.supplier.id,
        locationId: location.id,
        purchaseDate: prepared.purchaseDate,
        supplierInvoiceRef: normalizeOptionalText(prepared.command.supplierInvoiceRef),
        supplierNameSnapshot: prepared.supplier.name,
        supplierPhoneSnapshot: prepared.supplier.phone,
        supplierAddressSnapshot: prepared.supplier.address,
        subtotal: prepared.subtotal,
        additionalCharges: prepared.additionalCharges,
        totalAmount: prepared.totalAmount,
        notes: normalizeOptionalText(prepared.command.notes),
        createdById: actor.id,
      },
    });
    await createPreparedLots(transaction, purchase.id, actor.id, prepared.lots);
    return purchase;
  });
}

export async function updatePurchaseDraft(
  id: string,
  input: PurchaseDraftCommand,
  actor: AuthorizedUser,
) {
  assertOperationalWriter(actor);
  id = parseIdentifier(id, "Purchase identifier");
  return runInBusinessTransaction(prisma, async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Purchase" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const current = await transaction.purchase.findUnique({
      where: { id },
      include: { lots: true },
    });
    if (!current) throw new ApplicationError("NOT_FOUND", "Purchase was not found");
    if (current.status !== "DRAFT") {
      throw new ApplicationError("CONFLICT", "Only draft purchases can be edited");
    }
    const prepared = await prepareDraft(transaction, input);
    const existingLotIds = new Set(current.lots.map((lot) => lot.id));
    for (const lot of prepared.lots) {
      if (lot.id && !existingLotIds.has(lot.id)) {
        throw new ApplicationError(
          "VALIDATION_ERROR",
          "A purchase lot does not belong to this draft",
        );
      }
    }
    await transaction.purchaseLine.deleteMany({ where: { purchaseId: id } });
    const retainedIds = prepared.lots.flatMap((lot) => (lot.id ? [lot.id] : []));
    await transaction.purchaseLot.deleteMany({
      where: { purchaseId: id, ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}) },
    });
    const purchase = await transaction.purchase.update({
      where: { id },
      data: {
        supplierId: prepared.supplier.id,
        purchaseDate: prepared.purchaseDate,
        supplierInvoiceRef: normalizeOptionalText(prepared.command.supplierInvoiceRef),
        supplierNameSnapshot: prepared.supplier.name,
        supplierPhoneSnapshot: prepared.supplier.phone,
        supplierAddressSnapshot: prepared.supplier.address,
        subtotal: prepared.subtotal,
        additionalCharges: prepared.additionalCharges,
        totalAmount: prepared.totalAmount,
        notes: normalizeOptionalText(prepared.command.notes),
      },
    });
    await createPreparedLots(transaction, id, actor.id, prepared.lots);
    return purchase;
  });
}

async function settlementForPurchase(transaction: BusinessTransaction, purchaseId: string) {
  const [allocations, returns] = await Promise.all([
    transaction.supplierPaymentAllocation.aggregate({
      where: { purchaseId, payment: { status: "POSTED" } },
      _sum: { amount: true },
    }),
    transaction.purchaseReturn.aggregate({
      where: { purchaseId, status: "POSTED" },
      _sum: { totalAmount: true },
    }),
  ]);
  return decimal(allocations._sum.amount ?? 0).plus(returns._sum.totalAmount ?? 0);
}

async function refreshPurchasePaymentStatus(transaction: BusinessTransaction, purchaseId: string) {
  const purchase = await transaction.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
  const settled = await settlementForPurchase(transaction, purchaseId);
  const cached = Decimal.min(settled, decimal(purchase.totalAmount));
  await transaction.purchase.update({
    where: { id: purchaseId },
    data: {
      amountPaidCached: cached.toFixed(2),
      paymentStatus: paymentStatus(purchase.totalAmount.toString(), settled),
    },
  });
}

export async function postPurchase(
  id: string,
  actor: AuthorizedUser,
  paymentInput: PurchasePostingPayment = { paymentType: "CREDIT" },
) {
  assertOperationalWriter(actor);
  id = parseIdentifier(id, "Purchase identifier");
  const payment = parseCommand(purchasePostingPaymentSchema, paymentInput);
  return runInBusinessTransaction(prisma, async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Purchase" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const purchase = await transaction.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        location: true,
        lots: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            lines: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              include: { product: { include: { inventoryUnit: true } } },
            },
          },
        },
      },
    });
    if (!purchase) throw new ApplicationError("NOT_FOUND", "Purchase was not found");
    if (purchase.status === "POSTED") return purchase;
    if (purchase.status !== "DRAFT") {
      throw new ApplicationError("CONFLICT", "This purchase is not eligible for posting");
    }
    if (!purchase.supplier.isActive) {
      throw new ApplicationError("VALIDATION_ERROR", "The supplier is inactive");
    }
    if (!purchase.location.isActive || !purchase.location.isDefault) {
      throw new ApplicationError(
        "INVARIANT_VIOLATION",
        "The purchase does not use the active default location",
      );
    }
    if (purchase.lots.length === 0 || purchase.lots.some((lot) => lot.lines.length === 0)) {
      throw new ApplicationError("VALIDATION_ERROR", "A purchase needs at least one populated lot");
    }

    let subtotal = new Decimal(0);
    for (const lot of purchase.lots) {
      for (const line of lot.lines) {
        if (!line.product.isActive || !line.product.inventoryUnit.isActive) {
          throw new ApplicationError(
            "VALIDATION_ERROR",
            "Every line must reference an active product and unit",
          );
        }
        const calculated = purchaseLineAmount(
          line.quantity.toString(),
          line.unitPurchasePrice.toString(),
          line.product.inventoryUnit.decimalScale,
          line.lineDiscountAmount.toString(),
        );
        if (
          !calculated.grossAmount.equals(line.grossAmount.toString()) ||
          !calculated.unitCost.equals(line.unitCost.toString()) ||
          !calculated.lineTotal.equals(line.lineTotal.toString())
        ) {
          throw new ApplicationError(
            "INVARIANT_VIOLATION",
            "A purchase line total does not reconcile",
          );
        }
        subtotal = subtotal.plus(calculated.lineTotal);
      }
    }
    if (
      !subtotal.equals(purchase.subtotal.toString()) ||
      !subtotal.plus(purchase.additionalCharges.toString()).equals(purchase.totalAmount.toString())
    ) {
      throw new ApplicationError("INVARIANT_VIOLATION", "Purchase totals do not reconcile");
    }

    const postedAt = new Date();
    await transaction.purchase.update({
      where: { id },
      data: {
        supplierNameSnapshot: purchase.supplier.name,
        supplierPhoneSnapshot: purchase.supplier.phone,
        supplierAddressSnapshot: purchase.supplier.address,
      },
    });
    for (const lot of purchase.lots) {
      for (const line of lot.lines) {
        await transaction.purchaseLine.update({
          where: { id: line.id },
          data: {
            productNameSnapshot: line.product.name,
            skuSnapshot: line.product.sku,
            uomCodeSnapshot: line.product.inventoryUnit.code,
          },
        });
        const inventoryLot = await transaction.inventoryLot.create({
          data: {
            origin: "PURCHASE",
            productId: line.productId,
            locationId: purchase.locationId,
            purchaseLotId: lot.id,
            purchaseLineId: line.id,
            originalQuantity: line.quantity,
            availableQuantity: line.quantity,
            unitCost: line.unitCost,
            receivedAt: lot.receivedAt,
          },
        });
        await transaction.stockMovement.create({
          data: {
            productId: line.productId,
            locationId: purchase.locationId,
            inventoryLotId: inventoryLot.id,
            direction: "IN",
            movementType: "PURCHASE",
            quantity: line.quantity,
            unitCostSnapshot: line.unitCost,
            occurredAt: lot.receivedAt,
            createdById: actor.id,
            purchaseLineId: line.id,
          },
        });
      }
    }
    await transaction.supplierLedgerEntry.create({
      data: {
        supplierId: purchase.supplierId,
        entryDate: purchase.purchaseDate,
        entryType: "PURCHASE",
        effect: "INCREASE",
        amount: purchase.totalAmount,
        purchaseId: purchase.id,
        reference: purchase.purchaseNumber,
        createdById: actor.id,
      },
    });
    const postedPurchase = await transaction.purchase.update({
      where: { id },
      data: { status: "POSTED", postedAt },
    });
    if (payment.paymentType !== "CREDIT") {
      const amount = positiveMoney(payment.amount, "Payment amount");
      const total = decimal(purchase.totalAmount);
      if (amount.greaterThan(total)) {
        throw new ApplicationError("VALIDATION_ERROR", "Payment cannot exceed the purchase total");
      }
      if (payment.paymentType === "PAID" && !amount.equals(total)) {
        throw new ApplicationError("VALIDATION_ERROR", "Paid purchases require the full amount");
      }
      if (payment.paymentType === "PARTIAL" && !amount.lessThan(total)) {
        throw new ApplicationError(
          "VALIDATION_ERROR",
          "Partial payment must be less than the purchase total",
        );
      }
      const method = await transaction.paymentMethod.findUnique({
        where: { id: payment.paymentMethodId },
      });
      if (!method?.isActive) {
        throw new ApplicationError("VALIDATION_ERROR", "Select an active payment method");
      }
      const supplierPayment = await transaction.payment.create({
        data: {
          requestKey: purchase.id,
          paymentNumber: await nextDocumentNumber(transaction, "payment"),
          kind: "SUPPLIER_PAYMENT",
          status: "POSTED",
          supplierId: purchase.supplierId,
          paymentMethodId: method.id,
          paymentDate: purchase.purchaseDate,
          amount: amount.toFixed(2),
          reference: purchase.purchaseNumber,
          notes: purchase.notes ?? "Payment recorded when purchase was posted",
          createdById: actor.id,
          postedAt,
        },
      });
      await transaction.supplierPaymentAllocation.create({
        data: {
          paymentId: supplierPayment.id,
          purchaseId: purchase.id,
          amount: amount.toFixed(2),
        },
      });
      await transaction.supplierLedgerEntry.create({
        data: {
          supplierId: purchase.supplierId,
          entryDate: purchase.purchaseDate,
          entryType: "PAYMENT",
          effect: "DECREASE",
          amount: amount.toFixed(2),
          paymentId: supplierPayment.id,
          reference: supplierPayment.paymentNumber,
          createdById: actor.id,
        },
      });
      await transaction.purchase.update({
        where: { id: purchase.id },
        data: {
          amountPaidCached: amount.toFixed(2),
          paymentStatus: paymentStatus(total, amount),
        },
      });
    }
    return postedPurchase;
  });
}

export async function recordSupplierPayment(input: SupplierPaymentCommand, actor: AuthorizedUser) {
  assertOperationalWriter(actor);
  return runInBusinessTransaction(prisma, async (transaction) => {
    const command = parseCommand(supplierPaymentCommandSchema, input);
    const amount = positiveMoney(command.amount, "Payment amount");
    const supplier = await transaction.supplier.findUnique({ where: { id: command.supplierId } });
    if (!supplier?.isActive)
      throw new ApplicationError("VALIDATION_ERROR", "Select an active supplier");
    const method = await transaction.paymentMethod.findUnique({
      where: { id: command.paymentMethodId },
    });
    if (!method?.isActive)
      throw new ApplicationError("VALIDATION_ERROR", "Select an active payment method");

    const allocationByPurchase = new Map<string, Decimal>();
    for (const allocation of command.allocations) {
      const value = positiveMoney(allocation.amount, "Allocation amount");
      allocationByPurchase.set(
        allocation.purchaseId,
        (allocationByPurchase.get(allocation.purchaseId) ?? new Decimal(0)).plus(value),
      );
    }
    const allocated = [...allocationByPurchase.values()].reduce(
      (sum, value) => sum.plus(value),
      new Decimal(0),
    );
    if (allocated.greaterThan(amount)) {
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Allocations cannot exceed the payment amount",
      );
    }
    const purchaseIds = [...allocationByPurchase.keys()].sort();
    for (const purchaseId of purchaseIds) {
      await transaction.$queryRaw`SELECT "id" FROM "Purchase" WHERE "id" = ${purchaseId}::uuid FOR UPDATE`;
    }
    const purchases = await transaction.purchase.findMany({ where: { id: { in: purchaseIds } } });
    const purchaseById = new Map(purchases.map((purchase) => [purchase.id, purchase]));
    for (const purchaseId of purchaseIds) {
      const purchase = purchaseById.get(purchaseId);
      if (!purchase || purchase.supplierId !== supplier.id || purchase.status !== "POSTED") {
        throw new ApplicationError(
          "VALIDATION_ERROR",
          "Allocations must target posted purchases for this supplier",
        );
      }
      const settled = await settlementForPurchase(transaction, purchaseId);
      const outstanding = Decimal.max(decimal(purchase.totalAmount).minus(settled), 0);
      if ((allocationByPurchase.get(purchaseId) ?? new Decimal(0)).greaterThan(outstanding)) {
        throw new ApplicationError(
          "VALIDATION_ERROR",
          `Allocation exceeds the outstanding amount for ${purchase.purchaseNumber}`,
        );
      }
    }

    const paymentDate = parseBusinessDate(command.paymentDate, "Payment date");
    const postedAt = new Date();
    const payment = await transaction.payment.create({
      data: {
        paymentNumber: await nextDocumentNumber(transaction, "payment"),
        kind: "SUPPLIER_PAYMENT",
        status: "DRAFT",
        supplierId: supplier.id,
        paymentMethodId: method.id,
        paymentDate,
        amount: amount.toFixed(2),
        reference: normalizeOptionalText(command.reference),
        notes: normalizeOptionalText(command.notes),
        createdById: actor.id,
        postedAt,
      },
    });
    if (purchaseIds.length) {
      await transaction.supplierPaymentAllocation.createMany({
        data: purchaseIds.map((purchaseId) => ({
          paymentId: payment.id,
          purchaseId,
          amount: allocationByPurchase.get(purchaseId)!.toFixed(2),
        })),
      });
    }
    await transaction.supplierLedgerEntry.create({
      data: {
        supplierId: supplier.id,
        entryDate: paymentDate,
        entryType: "PAYMENT",
        effect: "DECREASE",
        amount: amount.toFixed(2),
        paymentId: payment.id,
        reference: payment.paymentNumber,
        createdById: actor.id,
      },
    });
    const postedPayment = await transaction.payment.update({
      where: { id: payment.id },
      data: { status: "POSTED", postedAt },
    });
    for (const purchaseId of purchaseIds)
      await refreshPurchasePaymentStatus(transaction, purchaseId);
    return postedPayment;
  });
}

export async function postPurchaseReturn(input: PurchaseReturnCommand, actor: AuthorizedUser) {
  assertOperationalWriter(actor);
  return runInBusinessTransaction(prisma, async (transaction) => {
    const command = parseCommand(purchaseReturnCommandSchema, input);
    await transaction.$queryRaw`SELECT "id" FROM "Purchase" WHERE "id" = ${command.purchaseId}::uuid FOR UPDATE`;
    const purchase = await transaction.purchase.findUnique({
      where: { id: command.purchaseId },
      include: { supplier: true },
    });
    if (!purchase || purchase.status !== "POSTED") {
      throw new ApplicationError("VALIDATION_ERROR", "Returns require a posted purchase");
    }
    if (!purchase.supplier.isActive) {
      throw new ApplicationError("VALIDATION_ERROR", "The supplier is inactive");
    }
    const quantityByLine = new Map<string, Decimal>();
    for (const inputLine of command.lines) {
      const quantity = decimal(inputLine.quantity);
      if (quantity.lessThanOrEqualTo(0))
        throw new ApplicationError("VALIDATION_ERROR", "Return quantity must be greater than zero");
      quantityByLine.set(
        inputLine.purchaseLineId,
        (quantityByLine.get(inputLine.purchaseLineId) ?? new Decimal(0)).plus(quantity),
      );
    }
    const lineIds = [...quantityByLine.keys()].sort();
    const lines = await transaction.purchaseLine.findMany({
      where: { id: { in: lineIds }, purchaseId: purchase.id },
      include: { inventoryLot: true, product: { include: { inventoryUnit: true } } },
    });
    if (lines.length !== lineIds.length || lines.some((line) => !line.inventoryLot)) {
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Every return line must belong to this posted purchase",
      );
    }
    const inventoryLotIds = lines.map((line) => line.inventoryLot!.id).sort();
    for (const inventoryLotId of inventoryLotIds) {
      await transaction.$queryRaw`SELECT "id" FROM "InventoryLot" WHERE "id" = ${inventoryLotId}::uuid FOR UPDATE`;
    }
    const lockedLots = await transaction.inventoryLot.findMany({
      where: { id: { in: inventoryLotIds } },
    });
    const lotById = new Map(lockedLots.map((lot) => [lot.id, lot]));
    let total = new Decimal(0);
    const prepared = lines.map((line) => {
      const quantity = validateQuantity(
        quantityByLine.get(line.id)!,
        line.product.inventoryUnit.decimalScale,
      );
      const inventoryLot = lotById.get(line.inventoryLot!.id);
      if (!inventoryLot || quantity.greaterThan(inventoryLot.availableQuantity.toString())) {
        throw new ApplicationError(
          "INSUFFICIENT_STOCK",
          `Return quantity exceeds available quantity for ${line.skuSnapshot}`,
        );
      }
      const lineTotal = roundMoney(quantity.times(line.unitCost.toString()));
      total = total.plus(lineTotal);
      return { line, inventoryLot, quantity, lineTotal };
    });
    const returnDate = parseBusinessDate(command.returnDate, "Return date");
    const postedAt = new Date();
    const purchaseReturn = await transaction.purchaseReturn.create({
      data: {
        returnNumber: await nextDocumentNumber(transaction, "purchaseReturn"),
        purchaseId: purchase.id,
        supplierId: purchase.supplierId,
        locationId: purchase.locationId,
        returnDate,
        supplierNameSnapshot: purchase.supplierNameSnapshot,
        status: "DRAFT",
        totalAmount: total.toFixed(2),
        reason: command.reason.trim(),
        notes: normalizeOptionalText(command.notes),
        createdById: actor.id,
      },
    });
    for (const item of prepared) {
      const returnLine = await transaction.purchaseReturnLine.create({
        data: {
          purchaseReturnId: purchaseReturn.id,
          purchaseLineId: item.line.id,
          productId: item.line.productId,
          inventoryLotId: item.inventoryLot.id,
          quantity: item.quantity.toFixed(),
          unitCost: item.line.unitCost,
          lineTotal: item.lineTotal.toFixed(2),
        },
      });
      const remaining = decimal(item.inventoryLot.availableQuantity).minus(item.quantity);
      await transaction.inventoryLot.update({
        where: { id: item.inventoryLot.id },
        data: {
          availableQuantity: remaining.toFixed(),
          status: remaining.isZero() ? "DEPLETED" : "OPEN",
          closedAt: remaining.isZero() ? postedAt : null,
        },
      });
      await transaction.stockMovement.create({
        data: {
          productId: item.line.productId,
          locationId: purchase.locationId,
          inventoryLotId: item.inventoryLot.id,
          direction: "OUT",
          movementType: "PURCHASE_RETURN",
          quantity: item.quantity.toFixed(),
          unitCostSnapshot: item.line.unitCost,
          occurredAt: postedAt,
          reason: command.reason.trim(),
          createdById: actor.id,
          purchaseReturnLineId: returnLine.id,
        },
      });
    }
    await transaction.supplierLedgerEntry.create({
      data: {
        supplierId: purchase.supplierId,
        entryDate: returnDate,
        entryType: "PURCHASE_RETURN",
        effect: "DECREASE",
        amount: total.toFixed(2),
        purchaseReturnId: purchaseReturn.id,
        reference: purchaseReturn.returnNumber,
        reason: command.reason.trim(),
        createdById: actor.id,
      },
    });
    const result = await transaction.purchaseReturn.update({
      where: { id: purchaseReturn.id },
      data: { status: "POSTED", postedAt },
    });
    await refreshPurchasePaymentStatus(transaction, purchase.id);
    return result;
  });
}
