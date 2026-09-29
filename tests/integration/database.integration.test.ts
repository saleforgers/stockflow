import "dotenv/config";

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  foundationExpenseCategories,
  foundationPaymentMethods,
  foundationUnits,
  seedFoundationData,
} from "../../prisma/seed-data";
import { PrismaClient } from "../../src/generated/prisma/client";

const databaseUrl = process.env["DIRECT_URL"];

if (!databaseUrl) {
  throw new Error("DIRECT_URL is required for database integration tests");
}

if (process.env["STOCKFLOW_DATABASE_TARGET"] !== "development-disposable") {
  throw new Error(
    "Refusing database integration tests unless STOCKFLOW_DATABASE_TARGET=development-disposable",
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const marker = "stockflow-integration-test";

function uniqueValue(prefix: string): string {
  return `${prefix}${randomUUID().replaceAll("-", "")}`;
}

function documentNumber(prefix: string): string {
  return `${prefix}-${Date.now()}${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0")}`;
}

async function createProductFixture() {
  const category = await prisma.category.create({
    data: { name: uniqueValue("IT Category "), slug: uniqueValue("it-category-") },
  });
  const unit = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: "PCS" } });
  const sku = uniqueValue("IT-SKU-");

  return { category, unit, sku };
}

async function createCommercialFixture() {
  const location = await prisma.inventoryLocation.findUniqueOrThrow({ where: { code: "MAIN" } });
  const paymentMethod = await prisma.paymentMethod.findUniqueOrThrow({ where: { code: "CASH" } });
  const user = await prisma.user.create({
    data: {
      name: marker,
      email: `${uniqueValue("it-")}@example.test`,
      role: "ADMIN",
    },
  });
  const supplier = await prisma.supplier.create({
    data: { name: uniqueValue("IT Supplier "), notes: marker },
  });
  const productFixture = await createProductFixture();
  const product = await prisma.product.create({
    data: {
      sku: productFixture.sku,
      name: marker,
      categoryId: productFixture.category.id,
      inventoryUnitId: productFixture.unit.id,
    },
  });

  return { location, paymentMethod, user, supplier, product };
}

async function cleanupTestData() {
  await prisma.purchaseLine.deleteMany({ where: { notes: marker } });
  await prisma.purchaseLot.deleteMany({ where: { notes: marker } });
  await prisma.purchase.deleteMany({ where: { notes: marker } });
  await prisma.payment.deleteMany({ where: { notes: marker } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: "IT-SKU-" } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: "it-category-" } } });
  await prisma.supplier.deleteMany({ where: { notes: marker } });
  await prisma.customer.deleteMany({ where: { notes: marker, isWalkIn: false } });
  await prisma.user.deleteMany({ where: { name: marker } });
  await prisma.inventoryLocation.deleteMany({ where: { code: { startsWith: "IT-" } } });
  await prisma.unitOfMeasure.deleteMany({ where: { code: { startsWith: "IT-" } } });
}

describe("database foundation constraints", () => {
  beforeAll(async () => {
    await prisma.$connect();
    await seedFoundationData(prisma);
  });

  afterEach(cleanupTestData);

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("allows only one active default inventory location", async () => {
    await expect(
      prisma.inventoryLocation.create({
        data: { code: uniqueValue("IT-"), name: marker, isDefault: true, isActive: true },
      }),
    ).rejects.toBeTruthy();
  });

  it("allows only one controlled walk-in customer", async () => {
    await expect(
      prisma.customer.create({ data: { name: marker, notes: marker, isWalkIn: true } }),
    ).rejects.toBeTruthy();
  });

  it("rejects a duplicate product SKU", async () => {
    const fixture = await createProductFixture();
    await prisma.product.create({
      data: {
        sku: fixture.sku,
        name: marker,
        categoryId: fixture.category.id,
        inventoryUnitId: fixture.unit.id,
      },
    });

    await expect(
      prisma.product.create({
        data: {
          sku: fixture.sku,
          name: `${marker} duplicate`,
          categoryId: fixture.category.id,
          inventoryUnitId: fixture.unit.id,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects an invalid UOM decimal scale", async () => {
    await expect(
      prisma.unitOfMeasure.create({
        data: { code: uniqueValue("IT-"), name: uniqueValue("IT Unit "), decimalScale: 5 },
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects negative product prices", async () => {
    const fixture = await createProductFixture();

    await expect(
      prisma.product.create({
        data: {
          sku: fixture.sku,
          name: marker,
          categoryId: fixture.category.id,
          inventoryUnitId: fixture.unit.id,
          defaultPurchasePrice: "-0.0001",
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects an invalid internal purchase-lot number", async () => {
    const fixture = await createCommercialFixture();
    const purchase = await prisma.purchase.create({
      data: {
        purchaseNumber: documentNumber("PUR"),
        supplierId: fixture.supplier.id,
        locationId: fixture.location.id,
        purchaseDate: new Date(),
        supplierNameSnapshot: fixture.supplier.name,
        subtotal: "0",
        totalAmount: "0",
        notes: marker,
        createdById: fixture.user.id,
      },
    });

    await expect(
      prisma.purchaseLot.create({
        data: {
          lotNumber: "INVALID-LOT",
          purchaseId: purchase.id,
          receivedAt: new Date(),
          notes: marker,
          createdById: fixture.user.id,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects a purchase line whose purchase differs from its purchase lot", async () => {
    const fixture = await createCommercialFixture();
    const purchaseData = {
      supplierId: fixture.supplier.id,
      locationId: fixture.location.id,
      purchaseDate: new Date(),
      supplierNameSnapshot: fixture.supplier.name,
      subtotal: "0",
      totalAmount: "0",
      notes: marker,
      createdById: fixture.user.id,
    } as const;
    const firstPurchase = await prisma.purchase.create({
      data: { ...purchaseData, purchaseNumber: documentNumber("PUR") },
    });
    const secondPurchase = await prisma.purchase.create({
      data: { ...purchaseData, purchaseNumber: documentNumber("PUR") },
    });
    const lot = await prisma.purchaseLot.create({
      data: {
        lotNumber: documentNumber("LOT"),
        purchaseId: firstPurchase.id,
        receivedAt: new Date(),
        notes: marker,
        createdById: fixture.user.id,
      },
    });

    await expect(
      prisma.purchaseLine.create({
        data: {
          purchaseId: secondPurchase.id,
          purchaseLotId: lot.id,
          productId: fixture.product.id,
          productNameSnapshot: fixture.product.name,
          skuSnapshot: fixture.product.sku,
          uomCodeSnapshot: "PCS",
          quantity: "1",
          unitCost: "10",
          lineTotal: "10",
          notes: marker,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects payment party and kind mismatches", async () => {
    const fixture = await createCommercialFixture();

    await expect(
      prisma.payment.create({
        data: {
          paymentNumber: documentNumber("PAY"),
          kind: "CUSTOMER_RECEIPT",
          supplierId: fixture.supplier.id,
          paymentMethodId: fixture.paymentMethod.id,
          paymentDate: new Date(),
          amount: "1",
          notes: marker,
          createdById: fixture.user.id,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects non-PKR transactional data", async () => {
    const fixture = await createCommercialFixture();

    await expect(
      prisma.payment.create({
        data: {
          paymentNumber: documentNumber("PAY"),
          kind: "SUPPLIER_PAYMENT",
          supplierId: fixture.supplier.id,
          paymentMethodId: fixture.paymentMethod.id,
          paymentDate: new Date(),
          amount: "1",
          currencyCode: "USD",
          notes: marker,
          createdById: fixture.user.id,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("seeds foundation data repeatedly without duplication", async () => {
    await seedFoundationData(prisma);
    await seedFoundationData(prisma);

    expect(await prisma.inventoryLocation.count({ where: { code: "MAIN", isDefault: true } })).toBe(
      1,
    );
    expect(
      await prisma.unitOfMeasure.count({
        where: { code: { in: foundationUnits.map(({ code }) => code) } },
      }),
    ).toBe(foundationUnits.length);
    expect(
      await prisma.paymentMethod.count({
        where: { code: { in: foundationPaymentMethods.map(({ code }) => code) } },
      }),
    ).toBe(foundationPaymentMethods.length);
    expect(
      await prisma.expenseCategory.count({
        where: { name: { in: [...foundationExpenseCategories] } },
      }),
    ).toBe(foundationExpenseCategories.length);
    expect(await prisma.customer.count({ where: { isWalkIn: true } })).toBe(1);
  });
});
