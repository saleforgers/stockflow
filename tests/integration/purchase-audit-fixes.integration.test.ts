import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma as db } from "../../src/lib/db/prisma";
import { seedFoundationData } from "../../prisma/seed-data";
import type { AuthorizedUser } from "../../src/lib/auth/authorization";
import { createPurchaseDraft, postPurchase } from "../../src/modules/purchases/services";

if (process.env["STOCKFLOW_DATABASE_TARGET"] !== "development-disposable") {
  throw new Error("Purchase audit acceptance requires a confirmed disposable development database");
}

const marker = `P3-IT-${randomUUID()}`;
const date = "2026-09-30";
let actor: AuthorizedUser;
let supplierId: string;
let otherSupplierId: string;
let productId: string;

function input(reference?: string, quantity = "333", discount = "0.01") {
  return {
    supplierId,
    supplierInvoiceRef: reference,
    purchaseDate: date,
    additionalCharges: "0",
    notes: marker,
    lots: [
      {
        receivedAt: `${date}T00:00:00Z`,
        lines: [{ productId, quantity, unitCost: "1", lineDiscountAmount: discount }],
      },
    ],
  };
}

describe("purchase audit fixes (append-only disposable fixtures)", () => {
  beforeAll(async () => {
    await seedFoundationData(db);
    actor = await db.user.create({
      data: { name: marker, email: `${randomUUID()}@example.test`, role: "ADMIN" },
    });
    supplierId = (await db.supplier.create({ data: { name: marker } })).id;
    otherSupplierId = (await db.supplier.create({ data: { name: marker } })).id;
    const unit = await db.unitOfMeasure.findUniqueOrThrow({ where: { code: "PCS" } });
    const category = await db.category.create({
      data: { name: marker, slug: marker.toLowerCase() },
    });
    productId = (
      await db.product.create({
        data: { name: marker, sku: marker, categoryId: category.id, inventoryUnitId: unit.id },
      })
    ).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("prevents duplicate supplier references, including concurrent draft creation", async () => {
    const reference = `${marker}-unique`;
    const results = await Promise.allSettled([
      createPurchaseDraft(input(reference), actor),
      createPurchaseDraft(input(reference), actor),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await db.purchase.count({ where: { supplierId, supplierInvoiceRef: reference } })).toBe(
      1,
    );
    await expect(createPurchaseDraft(input(reference), actor)).rejects.toThrow();
    const other = await createPurchaseDraft(
      { ...input(reference), supplierId: otherSupplierId },
      actor,
    );
    expect(other.supplierInvoiceRef).toBe(reference);
  });

  it("allows repeated absent and blank supplier references", async () => {
    const purchases = [];
    for (const reference of [undefined, undefined, "", "  "]) {
      purchases.push(await createPurchaseDraft(input(reference), actor));
    }
    expect(new Set(purchases.map((purchase) => purchase.id)).size).toBe(4);
    expect(purchases.every((purchase) => purchase.supplierInvoiceRef === null)).toBe(true);
  });

  it.each([
    ["0.01", "332.99"],
    ["0.02", "332.98"],
  ])(
    "posts and retries a one-paisa reconstruction difference with discount %s",
    async (discount, total) => {
      const draft = await createPurchaseDraft(
        input(`${marker}-${discount}`, "333", discount),
        actor,
      );
      await postPurchase(draft.id, actor);
      await postPurchase(draft.id, actor);
      const posted = await db.purchase.findUniqueOrThrow({
        where: { id: draft.id },
        include: { lines: true, ledgerEntry: true },
      });
      expect(posted.status).toBe("POSTED");
      expect(posted.totalAmount.toFixed(2)).toBe(total);
      expect(posted.lines[0]!.lineTotal.toFixed(2)).toBe(total);
      expect(posted.ledgerEntry!.amount.toFixed(2)).toBe(total);
      expect(await db.stockMovement.count({ where: { purchaseLineId: posted.lines[0]!.id } })).toBe(
        1,
      );
    },
  );

  it("enforces the tolerance and positive cost in SQL, even when application validation is bypassed", async () => {
    const draft = await createPurchaseDraft(input(`${marker}-sql`, "1000", "0"), actor);
    const line = await db.purchaseLine.findFirstOrThrow({ where: { purchaseId: draft.id } });
    await expect(
      db.purchaseLine.update({
        where: { id: line.id },
        data: { lineDiscountAmount: "0.02", lineTotal: "999.98" },
      }),
    ).rejects.toThrow();
    await expect(
      db.purchaseLine.update({
        where: { id: line.id },
        data: { lineDiscountAmount: "999.99", lineTotal: "0.01", unitCost: "0" },
      }),
    ).rejects.toThrow();
    expect(
      (await db.purchaseLine.findUniqueOrThrow({ where: { id: line.id } })).lineTotal.toFixed(2),
    ).toBe("1000.00");
  });
});
