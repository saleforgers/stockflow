import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma as db } from "../../src/lib/db/prisma";
import { seedFoundationData } from "../../prisma/seed-data";
import type { AuthorizedUser } from "../../src/lib/auth/authorization";
import { createPurchaseDraft, postPurchase } from "../../src/modules/purchases/services";
import {
  createInvoiceDraft,
  updateInvoiceDraft,
  postInvoice,
  recordCustomerReceipt,
  postSaleReturn,
  allocateCustomerAdvance,
} from "../../src/modules/sales/services";
import { getCustomerAccount } from "../../src/modules/sales/queries";

if (
  process.env["STOCKFLOW_DATABASE_TARGET"] !== "development-disposable" ||
  !process.env["DIRECT_URL"] ||
  !process.env["DATABASE_URL"]
) {
  throw new Error(
    "Phase 3 integration requires confirmed disposable development DATABASE_URL and DIRECT_URL",
  );
}
const marker = `P3-IT-${randomUUID()}`;
const date = "2026-10-01";
let actor: AuthorizedUser;
let supplierId: string;
let customerId: string;
let cash: string;
let unitId: string;
let categoryId: string;
async function fixture(lots = [{ quantity: "2", cost: "10", receivedAt: "2026-09-01T00:00:00Z" }]) {
  const product = await db.product.create({
    data: { sku: `${marker}-${randomUUID()}`, name: marker, inventoryUnitId: unitId, categoryId },
  });
  const purchase = await createPurchaseDraft(
    {
      supplierId,
      purchaseDate: date,
      additionalCharges: "0",
      notes: marker,
      lots: lots.map((l) => ({
        receivedAt: l.receivedAt,
        lines: [{ productId: product.id, quantity: l.quantity, unitCost: l.cost }],
      })),
    },
    actor,
  );
  await postPurchase(purchase.id, actor);
  return product.id;
}
const input = (productId: string, quantity = "1", party = customerId) => ({
  customerId: party,
  invoiceDate: date,
  invoiceDiscountAmount: "0",
  notes: marker,
  lines: [{ productId, quantity, unitPrice: "100", lineDiscountAmount: "0" }],
});
async function invoice(productId: string, quantity = "1") {
  return createInvoiceDraft(input(productId, quantity), actor);
}
describe("Phase 3 sales acceptance (append-only disposable fixtures)", () => {
  beforeAll(async () => {
    await seedFoundationData(db);
    const user = await db.user.create({
      data: { name: marker, email: `${randomUUID()}@example.test`, role: "ADMIN" },
    });
    actor = { ...user, isActive: true };
    supplierId = (await db.supplier.create({ data: { name: marker } })).id;
    customerId = (await db.customer.create({ data: { name: marker } })).id;
    cash = (await db.paymentMethod.findUniqueOrThrow({ where: { code: "CASH" } })).id;
    unitId = (await db.unitOfMeasure.findUniqueOrThrow({ where: { code: "PCS" } })).id;
    categoryId = (await db.category.create({ data: { name: marker, slug: marker.toLowerCase() } }))
      .id;
  });
  // Keep posted audit records. Never bypass immutability or reset a shared database for cleanup.
  afterAll(async () => {
    await db.$disconnect();
  });
  it("posts FIFO across lots and duplicate requests create one complete set of effects", async () => {
    const productId = await fixture([
      { quantity: "2", cost: "10.1234", receivedAt: "2026-09-01T00:00:00Z" },
      { quantity: "2", cost: "20", receivedAt: "2026-09-02T00:00:00Z" },
    ]);
    const draft = await invoice(productId, "3");
    const results = await Promise.all([postInvoice(draft.id, actor), postInvoice(draft.id, actor)]);
    expect(results.every((r) => r.status === "POSTED")).toBe(true);
    const allocations = await db.saleLotAllocation.findMany({
      where: { salesInvoiceLine: { salesInvoiceId: draft.id } },
      include: { inventoryLot: true, stockMovement: true },
      orderBy: { inventoryLot: { receivedAt: "asc" } },
    });
    expect(allocations.map((a) => [a.quantity.toString(), a.unitCostSnapshot.toString()])).toEqual([
      ["2", "10.1234"],
      ["1", "20"],
    ]);
    expect(allocations.every((a) => a.stockMovement?.quantity.equals(a.quantity))).toBe(true);
    expect(await db.customerLedgerEntry.count({ where: { salesInvoiceId: draft.id } })).toBe(1);
    expect(await db.stockMovement.count({ where: { movementType: "SALE", productId } })).toBe(2);
    await expect(updateInvoiceDraft(draft.id, input(productId), actor)).rejects.toThrow(
      "Only drafts",
    );
    await expect(
      db.saleLotAllocation.update({ where: { id: allocations[0]!.id }, data: { quantity: "1" } }),
    ).rejects.toThrow();
  });
  it("permits exactly one of two concurrent final-stock sales", async () => {
    const productId = await fixture([
      { quantity: "1", cost: "10", receivedAt: "2026-09-01T00:00:00Z" },
    ]);
    const a = await invoice(productId);
    const b = await invoice(productId);
    const results = await Promise.allSettled([postInvoice(a.id, actor), postInvoice(b.id, actor)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.stockMovement.count({ where: { productId, movementType: "SALE" } })).toBe(1);
    expect(
      (
        await db.inventoryLot.findFirstOrThrow({ where: { productId } })
      ).availableQuantity.toString(),
    ).toBe("0");
    const loser = results[0]!.status === "rejected" ? a.id : b.id;
    expect(await db.customerLedgerEntry.count({ where: { salesInvoiceId: loser } })).toBe(0);
  });
  it("rolls back earlier line allocations when a later product is short", async () => {
    const productId = await fixture();
    const short = await fixture([
      { quantity: "1", cost: "10", receivedAt: "2026-09-01T00:00:00Z" },
    ]);
    const c = input(productId);
    c.lines.push({ productId: short, quantity: "2", unitPrice: "100", lineDiscountAmount: "0" });
    const draft = await createInvoiceDraft(c, actor);
    await expect(postInvoice(draft.id, actor)).rejects.toThrow("Insufficient");
    expect(
      await db.saleLotAllocation.count({
        where: { salesInvoiceLine: { salesInvoiceId: draft.id } },
      }),
    ).toBe(0);
    expect(
      await db.stockMovement.count({
        where: { productId: { in: [productId, short] }, movementType: "SALE" },
      }),
    ).toBe(0);
    expect((await db.salesInvoice.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe(
      "DRAFT",
    );
  });
  it("records partial receipts and advances and safely allocates later", async () => {
    const draft = await invoice(await fixture());
    await postInvoice(draft.id, actor);
    const requestKey = randomUUID();
    const c = {
      requestKey,
      customerId,
      paymentMethodId: cash,
      paymentDate: date,
      amount: "150",
      notes: marker,
      allocations: [{ salesInvoiceId: draft.id, amount: "40" }],
    };
    const p = await recordCustomerReceipt(c, actor);
    expect((await recordCustomerReceipt(c, actor)).id).toBe(p.id);
    expect(
      (await db.salesInvoice.findUniqueOrThrow({ where: { id: draft.id } })).paymentStatus,
    ).toBe("PARTIALLY_PAID");
    const account = await getCustomerAccount(customerId);
    expect(account?.payments.find((a) => a.id === p.id)?.unallocated).toBe("110.00");
    const other = await invoice(await fixture());
    await postInvoice(other.id, actor);
    const allocationKey = randomUUID();
    await allocateCustomerAdvance(
      { requestKey: allocationKey, paymentId: p.id, salesInvoiceId: other.id, amount: "50" },
      actor,
    );
    await allocateCustomerAdvance(
      { requestKey: allocationKey, paymentId: p.id, salesInvoiceId: other.id, amount: "50" },
      actor,
    );
    expect(await db.customerPaymentAllocation.count({ where: { paymentId: p.id } })).toBe(2);
    await allocateCustomerAdvance(
      { requestKey: randomUUID(), paymentId: p.id, salesInvoiceId: other.id, amount: "10" },
      actor,
    );
    expect(await db.customerPaymentAllocation.count({ where: { paymentId: p.id } })).toBe(3);
    await expect(
      recordCustomerReceipt(
        {
          ...c,
          requestKey: randomUUID(),
          amount: "100",
          allocations: [{ salesInvoiceId: draft.id, amount: "61" }],
        },
        actor,
      ),
    ).rejects.toThrow("outstanding");
  });
  it("restores original allocation costs and discounted credits, rejects excess returns", async () => {
    const productId = await fixture([
      { quantity: "2", cost: "10.1234", receivedAt: "2026-09-01T00:00:00Z" },
      { quantity: "2", cost: "20", receivedAt: "2026-09-02T00:00:00Z" },
    ]);
    const c = input(productId, "3");
    c.invoiceDiscountAmount = "1";
    c.lines[0]!.lineDiscountAmount = "2";
    const draft = await createInvoiceDraft(c, actor);
    await postInvoice(draft.id, actor);
    const line = await db.salesInvoiceLine.findFirstOrThrow({
      where: { salesInvoiceId: draft.id },
    });
    const command = {
      requestKey: randomUUID(),
      salesInvoiceId: draft.id,
      returnDate: date,
      reason: "Damaged",
      lines: [{ salesInvoiceLineId: line.id, quantity: "2.0" }],
    };
    const returned = await postSaleReturn(command, actor);
    expect((await postSaleReturn(command, actor)).id).toBe(returned.id);
    expect(returned.totalAmount.toFixed(2)).toBe("198.00");
    const allocation = await db.saleReturnAllocation.findFirstOrThrow({
      where: { saleReturnLine: { saleReturnId: returned.id } },
      include: { inventoryLot: true, stockMovement: true },
    });
    expect(allocation.unitCostSnapshot.toString()).toBe("10.1234");
    expect(allocation.inventoryLot.availableQuantity.toString()).toBe("2");
    expect(allocation.stockMovement?.direction).toBe("IN");
    await expect(postSaleReturn({ ...command, requestKey: randomUUID() }, actor)).rejects.toThrow(
      "remaining",
    );
    const final = await postSaleReturn(
      {
        ...command,
        requestKey: randomUUID(),
        lines: [{ salesInvoiceLineId: line.id, quantity: "1" }],
      },
      actor,
    );
    expect(final.totalAmount.toFixed(2)).toBe("99.00");
  });
  it("requires atomic walk-in payment and rolls back invalid receipt method", async () => {
    const walkIn = await db.customer.findFirstOrThrow({ where: { isWalkIn: true } });
    const productId = await fixture();
    const draft = await createInvoiceDraft(input(productId, "1", walkIn.id), actor);
    await expect(postInvoice(draft.id, actor)).rejects.toThrow("fully paid");
    await expect(
      postInvoice(draft.id, actor, {
        paymentType: "PAID",
        paymentMethodId: randomUUID(),
        amount: "100",
      }),
    ).rejects.toThrow();
    expect(await db.stockMovement.count({ where: { productId, movementType: "SALE" } })).toBe(0);
    await postInvoice(draft.id, actor, {
      paymentType: "PAID",
      paymentMethodId: cash,
      amount: "100",
    });
    expect(
      (await db.salesInvoice.findUniqueOrThrow({ where: { id: draft.id } })).paymentStatus,
    ).toBe("PAID");
  });
  it("rejects staff and inactive actors before mutations", async () => {
    await expect(
      createInvoiceDraft(input(randomUUID()), { ...actor, role: "STAFF" }),
    ).rejects.toThrow("permission");
    await expect(
      recordCustomerReceipt(
        {
          requestKey: randomUUID(),
          customerId,
          paymentMethodId: cash,
          paymentDate: date,
          amount: "1",
          allocations: [],
        },
        { ...actor, isActive: false },
      ),
    ).rejects.toThrow("inactive");
  });
  it("preserves zero-impact history for a fully discounted invoice and return", async () => {
    const productId = await fixture();
    const command = input(productId);
    command.invoiceDiscountAmount = "100";
    const draft = await createInvoiceDraft(command, actor);
    await postInvoice(draft.id, actor);
    const posted = await db.salesInvoice.findUniqueOrThrow({
      where: { id: draft.id },
      include: { lines: true, ledgerEntry: true },
    });
    expect(posted.paymentStatus).toBe("PAID");
    expect(posted.ledgerEntry?.amount.toString()).toBe("0");
    const returned = await postSaleReturn(
      {
        requestKey: randomUUID(),
        salesInvoiceId: draft.id,
        returnDate: date,
        reason: "Return discounted item",
        lines: [{ salesInvoiceLineId: posted.lines[0]!.id, quantity: "1" }],
      },
      actor,
    );
    expect(returned.totalAmount.toString()).toBe("0");
    expect(
      (
        await db.customerLedgerEntry.findUniqueOrThrow({ where: { saleReturnId: returned.id } })
      ).amount.toString(),
    ).toBe("0");
  });
});
