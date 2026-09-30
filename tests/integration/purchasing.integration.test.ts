import "dotenv/config";

import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { seedFoundationData } from "../../prisma/seed-data";
import { PrismaClient } from "../../src/generated/prisma/client";
import type { AuthorizedUser } from "../../src/lib/auth/authorization";
import {
  createPurchaseDraft,
  postPurchase,
  postPurchaseReturn,
  recordSupplierPayment,
} from "../../src/modules/purchases/services";
import { getSupplierAccount } from "../../src/modules/purchases/queries";

const directUrl = process.env["DIRECT_URL"];
if (!directUrl) throw new Error("DIRECT_URL is required");
if (process.env["STOCKFLOW_DATABASE_TARGET"] !== "development-disposable") {
  throw new Error("Refusing Phase 2 integration tests on a non-disposable database");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: directUrl }) });
const marker = "stockflow-phase-2-integration";
const prefix = "P2-IT-";
let actor: AuthorizedUser;
let supplierId: string;
let pcsProductId: string;
let kgProductId: string;
let cashMethodId: string;

const unique = () => randomUUID().replaceAll("-", "").slice(0, 12);
const today = () => new Date().toISOString().slice(0, 10);

function draftInput(overrides?: { supplierId?: string; quantity?: string; lots?: number }) {
  const lots = overrides?.lots ?? 1;
  return {
    supplierId: overrides?.supplierId ?? supplierId,
    purchaseDate: today(),
    supplierInvoiceRef: `${prefix}BILL-${unique()}`,
    additionalCharges: "10.00",
    notes: marker,
    lots: Array.from({ length: lots }, (_, index) => ({
      supplierLotReference: `${prefix}SUP-${index}`,
      receivedAt: new Date().toISOString(),
      notes: marker,
      lines: [
        {
          productId: index % 2 ? kgProductId : pcsProductId,
          quantity: overrides?.quantity ?? (index % 2 ? "2.500" : "2"),
          unitCost: index % 2 ? "40.1234" : "50.0000",
          notes: marker,
        },
      ],
    })),
  };
}

async function postedPurchase(totalQuantity = "2") {
  const draft = await createPurchaseDraft(draftInput({ quantity: totalQuantity }), actor);
  await postPurchase(draft.id, actor);
  return db.purchase.findUniqueOrThrow({ where: { id: draft.id } });
}

async function cleanup() {
  const purchases = await db.purchase.findMany({ where: { notes: marker }, select: { id: true } });
  const purchaseIds = purchases.map((row) => row.id);
  const returns = await db.purchaseReturn.findMany({
    where: { purchaseId: { in: purchaseIds } },
    select: { id: true },
  });
  const returnIds = returns.map((row) => row.id);
  const payments = await db.payment.findMany({ where: { notes: marker }, select: { id: true } });
  const paymentIds = payments.map((row) => row.id);

  await db.purchase.updateMany({
    where: { id: { in: purchaseIds } },
    data: { status: "DRAFT", postedAt: null },
  });

  await db.stockMovement.deleteMany({
    where: {
      OR: [
        { purchaseLine: { purchaseId: { in: purchaseIds } } },
        { purchaseReturnLine: { purchaseReturnId: { in: returnIds } } },
      ],
    },
  });
  await db.supplierLedgerEntry.deleteMany({
    where: {
      OR: [
        { purchaseId: { in: purchaseIds } },
        { purchaseReturnId: { in: returnIds } },
        { paymentId: { in: paymentIds } },
      ],
    },
  });
  await db.supplierPaymentAllocation.deleteMany({ where: { paymentId: { in: paymentIds } } });
  await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
  await db.purchaseReturnLine.deleteMany({ where: { purchaseReturnId: { in: returnIds } } });
  await db.purchaseReturn.deleteMany({ where: { id: { in: returnIds } } });
  await db.inventoryLot.deleteMany({
    where: { purchaseLine: { purchaseId: { in: purchaseIds } } },
  });
  await db.purchaseLine.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
  await db.purchaseLot.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
  await db.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
}

describe("Phase 2 purchasing and supplier ledger", () => {
  beforeAll(async () => {
    await db.$connect();
    await seedFoundationData(db);
    const user = await db.user.create({
      data: { name: marker, email: `${prefix}${unique()}@example.test`, role: "ADMIN" },
    });
    actor = { id: user.id, name: user.name, email: user.email, role: user.role, isActive: true };
    const supplier = await db.supplier.create({
      data: { name: `${prefix}Supplier ${unique()}`, notes: marker },
    });
    supplierId = supplier.id;
    const category = await db.category.create({
      data: { name: `${prefix}Category ${unique()}`, slug: `p2-it-${unique()}` },
    });
    const [pcs, kg, cash] = await Promise.all([
      db.unitOfMeasure.findUniqueOrThrow({ where: { code: "PCS" } }),
      db.unitOfMeasure.findUniqueOrThrow({ where: { code: "KG" } }),
      db.paymentMethod.findUniqueOrThrow({ where: { code: "CASH" } }),
    ]);
    cashMethodId = cash.id;
    const [pcsProduct, kgProduct] = await Promise.all([
      db.product.create({
        data: {
          sku: `${prefix}PCS-${unique()}`,
          name: `${prefix}Pieces`,
          categoryId: category.id,
          inventoryUnitId: pcs.id,
        },
      }),
      db.product.create({
        data: {
          sku: `${prefix}KG-${unique()}`,
          name: `${prefix}Weight`,
          categoryId: category.id,
          inventoryUnitId: kg.id,
        },
      }),
    ]);
    pcsProductId = pcsProduct.id;
    kgProductId = kgProduct.id;
  });

  afterEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await db.product.deleteMany({ where: { sku: { startsWith: prefix } } });
    await db.category.deleteMany({ where: { slug: { startsWith: "p2-it-" } } });
    await db.supplier.deleteMany({ where: { notes: marker } });
    await db.user.deleteMany({ where: { name: marker } });
    await db.$disconnect();
  });

  it("creates a validated multi-lot draft and calculates authoritative totals", async () => {
    const purchase = await createPurchaseDraft(draftInput({ lots: 2 }), actor);
    const stored = await db.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: { lots: { include: { lines: true } } },
    });
    expect(stored.status).toBe("DRAFT");
    expect(stored.lots).toHaveLength(2);
    expect(stored.lots.flatMap((lot) => lot.lines)).toHaveLength(2);
    expect(stored.subtotal.toFixed(2)).toBe("200.31");
    expect(stored.totalAmount.toFixed(2)).toBe("210.31");
    expect(new Set(stored.lots.map((lot) => lot.lotNumber)).size).toBe(2);
  });

  it("rejects invalid fractional quantities and restricted service invocation", async () => {
    await expect(createPurchaseDraft(draftInput({ quantity: "1.5" }), actor)).rejects.toThrow(
      "at most 0",
    );
    await expect(createPurchaseDraft(draftInput(), { ...actor, role: "STAFF" })).rejects.toThrow(
      "permission",
    );
    expect(await db.purchase.count({ where: { notes: marker } })).toBe(0);
  });

  it("posts atomically, creates cost layers/movements/payable, and is idempotent", async () => {
    const draft = await createPurchaseDraft(draftInput({ lots: 2 }), actor);
    await postPurchase(draft.id, actor);
    await postPurchase(draft.id, actor);
    const purchase = await db.purchase.findUniqueOrThrow({
      where: { id: draft.id },
      include: { lines: true, ledgerEntry: true },
    });
    const inventoryLots = await db.inventoryLot.findMany({
      where: { purchaseLine: { purchaseId: draft.id } },
    });
    const movements = await db.stockMovement.findMany({
      where: { purchaseLine: { purchaseId: draft.id } },
    });
    expect(purchase.status).toBe("POSTED");
    expect(purchase.postedAt).not.toBeNull();
    expect(inventoryLots).toHaveLength(purchase.lines.length);
    expect(movements).toHaveLength(purchase.lines.length);
    expect(inventoryLots.every((lot) => lot.originalQuantity.equals(lot.availableQuantity))).toBe(
      true,
    );
    expect(
      movements.every(
        (movement) => movement.direction === "IN" && movement.movementType === "PURCHASE",
      ),
    ).toBe(true);
    expect(purchase.ledgerEntry?.effect).toBe("INCREASE");
    expect(purchase.ledgerEntry?.amount.equals(purchase.totalAmount)).toBe(true);
  });

  it("leaves no posting effects when validation fails inside the transaction", async () => {
    const draft = await createPurchaseDraft(draftInput(), actor);
    await db.product.update({ where: { id: pcsProductId }, data: { isActive: false } });
    await expect(postPurchase(draft.id, actor)).rejects.toThrow("active product");
    await db.product.update({ where: { id: pcsProductId }, data: { isActive: true } });
    expect(await db.inventoryLot.count({ where: { purchaseLine: { purchaseId: draft.id } } })).toBe(
      0,
    );
    expect(
      await db.stockMovement.count({ where: { purchaseLine: { purchaseId: draft.id } } }),
    ).toBe(0);
    expect(await db.supplierLedgerEntry.count({ where: { purchaseId: draft.id } })).toBe(0);
    expect((await db.purchase.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("DRAFT");
  });

  it("supports full, partial, repeated, multi-purchase, and on-account supplier payments", async () => {
    const first = await postedPurchase();
    const second = await postedPurchase();
    await recordSupplierPayment(
      {
        supplierId,
        paymentMethodId: cashMethodId,
        paymentDate: today(),
        amount: first.totalAmount.toFixed(2),
        reference: "full",
        notes: marker,
        allocations: [{ purchaseId: first.id, amount: first.totalAmount.toFixed(2) }],
      },
      actor,
    );
    await recordSupplierPayment(
      {
        supplierId,
        paymentMethodId: cashMethodId,
        paymentDate: today(),
        amount: "30",
        reference: "partial",
        notes: marker,
        allocations: [{ purchaseId: second.id, amount: "20" }],
      },
      actor,
    );
    await recordSupplierPayment(
      {
        supplierId,
        paymentMethodId: cashMethodId,
        paymentDate: today(),
        amount: "15",
        reference: "repeat",
        notes: marker,
        allocations: [{ purchaseId: second.id, amount: "10" }],
      },
      actor,
    );
    const onAccount = await recordSupplierPayment(
      {
        supplierId,
        paymentMethodId: cashMethodId,
        paymentDate: today(),
        amount: "25",
        reference: "advance",
        notes: marker,
        allocations: [],
      },
      actor,
    );
    const [firstStored, secondStored, account] = await Promise.all([
      db.purchase.findUniqueOrThrow({ where: { id: first.id } }),
      db.purchase.findUniqueOrThrow({ where: { id: second.id } }),
      getSupplierAccount(supplierId),
    ]);
    expect(firstStored.paymentStatus).toBe("PAID");
    expect(secondStored.paymentStatus).toBe("PARTIALLY_PAID");
    expect(secondStored.amountPaidCached.toFixed(2)).toBe("30.00");
    expect(account.payments.find((payment) => payment.id === onAccount.id)?.unallocated).toBe(
      "25.00",
    );
    expect(account.statement.filter((entry) => entry.entryType === "PAYMENT")).toHaveLength(4);
  });

  it("allocates one payment across purchases and rejects over-allocation without history", async () => {
    const first = await postedPurchase();
    const second = await postedPurchase();
    await recordSupplierPayment(
      {
        supplierId,
        paymentMethodId: cashMethodId,
        paymentDate: today(),
        amount: "100",
        notes: marker,
        allocations: [
          { purchaseId: first.id, amount: "50" },
          { purchaseId: second.id, amount: "50" },
        ],
      },
      actor,
    );
    expect(
      await db.supplierPaymentAllocation.count({ where: { payment: { notes: marker } } }),
    ).toBe(2);
    const before = await db.payment.count({ where: { notes: marker } });
    await expect(
      recordSupplierPayment(
        {
          supplierId,
          paymentMethodId: cashMethodId,
          paymentDate: today(),
          amount: "10",
          notes: marker,
          allocations: [{ purchaseId: first.id, amount: "11" }],
        },
        actor,
      ),
    ).rejects.toThrow("cannot exceed");
    expect(await db.payment.count({ where: { notes: marker } })).toBe(before);
  });

  it("posts an auditable purchase return and prevents negative lot availability", async () => {
    const purchase = await postedPurchase("5");
    const line = await db.purchaseLine.findFirstOrThrow({
      where: { purchaseId: purchase.id },
      include: { inventoryLot: true },
    });
    const returned = await postPurchaseReturn(
      {
        purchaseId: purchase.id,
        returnDate: today(),
        reason: "Damaged delivery",
        notes: marker,
        lines: [{ purchaseLineId: line.id, quantity: "2" }],
      },
      actor,
    );
    const [lot, movement, ledger, original] = await Promise.all([
      db.inventoryLot.findUniqueOrThrow({ where: { id: line.inventoryLot!.id } }),
      db.stockMovement.findFirstOrThrow({
        where: { purchaseReturnLine: { purchaseReturnId: returned.id } },
      }),
      db.supplierLedgerEntry.findUniqueOrThrow({ where: { purchaseReturnId: returned.id } }),
      db.purchase.findUniqueOrThrow({ where: { id: purchase.id } }),
    ]);
    expect(lot.availableQuantity.toFixed()).toBe("3");
    expect(movement.direction).toBe("OUT");
    expect(movement.movementType).toBe("PURCHASE_RETURN");
    expect(ledger.effect).toBe("DECREASE");
    expect(original.totalAmount.equals(purchase.totalAmount)).toBe(true);
    await expect(
      postPurchaseReturn(
        {
          purchaseId: purchase.id,
          returnDate: today(),
          reason: "Too much",
          notes: marker,
          lines: [{ purchaseLineId: line.id, quantity: "4" }],
        },
        actor,
      ),
    ).rejects.toThrow("exceeds available");
  });

  it("serializes concurrent returns so availability never becomes negative", async () => {
    const purchase = await postedPurchase("5");
    const line = await db.purchaseLine.findFirstOrThrow({
      where: { purchaseId: purchase.id },
      include: { inventoryLot: true },
    });
    const command = {
      purchaseId: purchase.id,
      returnDate: today(),
      reason: "Concurrent return",
      notes: marker,
      lines: [{ purchaseLineId: line.id, quantity: "3" }],
    };
    const results = await Promise.allSettled([
      postPurchaseReturn(command, actor),
      postPurchaseReturn(command, actor),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const lot = await db.inventoryLot.findUniqueOrThrow({ where: { id: line.inventoryLot!.id } });
    expect(lot.availableQuantity.toFixed()).toBe("2");
    expect(lot.availableQuantity.isNegative()).toBe(false);
  });
});
