import "dotenv/config";

import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedFoundationData } from "../../prisma/seed-data";
import { PrismaClient } from "../../src/generated/prisma/client";
import type { AuthorizedUser } from "../../src/lib/auth/authorization";
import { listProducts } from "../../src/modules/products/queries";
import { createProduct, updateProduct } from "../../src/modules/products/services";
import type { ProductCommand } from "../../src/modules/products/validation";

const directUrl = process.env["DIRECT_URL"];
if (!directUrl) throw new Error("DIRECT_URL is required");
if (process.env["STOCKFLOW_DATABASE_TARGET"] !== "development-disposable") {
  throw new Error("Refusing opening-stock integration tests on a non-disposable database");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: directUrl }) });
const fixtureId = randomUUID();
const marker = "Demo acceptance";
const actor: AuthorizedUser = {
  id: randomUUID(),
  name: marker,
  email: `${randomUUID()}@example.test`,
  role: "ADMIN",
  isActive: true,
};
let categoryId: string;
let pcsUnitId: string;
let kgUnitId: string;

function command(overrides: Partial<ProductCommand> = {}): ProductCommand {
  return {
    sku: randomUUID(),
    name: marker,
    categoryId,
    inventoryUnitId: pcsUnitId,
    preferredSupplierId: null,
    defaultPurchasePrice: "25.5000",
    defaultSellingPrice: "40",
    openingStockQuantity: "0",
    lowStockThreshold: "0",
    description: null,
    specifications: [],
    ...overrides,
  };
}

describe("product opening stock", () => {
  beforeAll(async () => {
    await db.$connect();
    await seedFoundationData(db);
    await db.user.create({ data: actor });
    categoryId = (
      await db.category.create({
        data: { name: marker, slug: `demo-acceptance-${fixtureId}` },
      })
    ).id;
    pcsUnitId = (await db.unitOfMeasure.findUniqueOrThrow({ where: { code: "PCS" } })).id;
    kgUnitId = (await db.unitOfMeasure.findUniqueOrThrow({ where: { code: "KG" } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates a product with zero opening stock without inventory records", async () => {
    const product = await createProduct(command(), actor);

    expect(await db.inventoryLot.count({ where: { productId: product.id } })).toBe(0);
    expect(await db.stockMovement.count({ where: { productId: product.id } })).toBe(0);
  });

  it("creates an opening lot and IN movement and reports the correct current stock", async () => {
    const product = await createProduct(command({ openingStockQuantity: "5" }), actor);
    const lot = await db.inventoryLot.findFirstOrThrow({ where: { productId: product.id } });
    const movement = await db.stockMovement.findFirstOrThrow({
      where: { productId: product.id },
      include: { location: true, adjustmentLine: { include: { stockAdjustment: true } } },
    });

    expect(lot.origin).toBe("OPENING");
    expect(lot.originalQuantity.toFixed()).toBe("5");
    expect(lot.availableQuantity.toFixed()).toBe("5");
    expect(lot.unitCost.toFixed()).toBe("25.5");
    expect(movement.movementType).toBe("OPENING_STOCK");
    expect(movement.direction).toBe("IN");
    expect(movement.quantity.toFixed()).toBe("5");
    expect(movement.unitCostSnapshot?.toFixed()).toBe("25.5");
    expect(movement.location.isDefault).toBe(true);
    expect(movement.adjustmentLine?.stockAdjustment.status).toBe("POSTED");

    const result = await listProducts({ search: product.sku, page: 1 });
    expect(result.items.find((item) => item.id === product.id)?.onHand).toBe("5");
  });

  it("rejects a negative opening quantity without creating the product", async () => {
    const input = command({ openingStockQuantity: "-1" });

    await expect(createProduct(input, actor)).rejects.toThrow(
      "Opening stock quantity cannot be negative",
    );
    expect(await db.product.count({ where: { sku: input.sku } })).toBe(0);
  });

  it("validates opening quantity against the inventory unit decimal scale", async () => {
    const pieces = command({ openingStockQuantity: "1.5" });
    await expect(createProduct(pieces, actor)).rejects.toThrow("at most 0 decimal places");

    const kilograms = await createProduct(
      command({ inventoryUnitId: kgUnitId, openingStockQuantity: "1.234" }),
      actor,
    );
    const movement = await db.stockMovement.findFirstOrThrow({
      where: { productId: kilograms.id },
    });
    expect(movement.quantity.toFixed()).toBe("1.234");
  });

  it("requires a positive default purchase price for positive opening stock", async () => {
    const input = command({ defaultPurchasePrice: null, openingStockQuantity: "2" });

    await expect(createProduct(input, actor)).rejects.toThrow(
      "Opening stock requires a positive Default Purchase Price",
    );
    expect(await db.product.count({ where: { sku: input.sku } })).toBe(0);
  });

  it("rejects attempts to overwrite stock through product editing", async () => {
    const original = command();
    const product = await createProduct(original, actor);

    await expect(
      updateProduct(product.id, { ...original, openingStockQuantity: "3" }, actor),
    ).rejects.toThrow("Use Adjust Stock instead");
    expect(await db.stockMovement.count({ where: { productId: product.id } })).toBe(0);
  });
});
