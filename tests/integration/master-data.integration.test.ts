import "dotenv/config";

import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { seedFoundationData } from "../../prisma/seed-data";
import { PrismaClient } from "../../src/generated/prisma/client";
import type { AuthorizedUser } from "../../src/lib/auth/authorization";
import {
  createCategory,
  setCategoryActive,
  updateCategory,
} from "../../src/modules/categories/services";
import {
  createCustomer,
  createTransactionCustomer,
  setCustomerActive,
  updateCustomer,
} from "../../src/modules/customers/services";
import { createProduct, setProductActive } from "../../src/modules/products/services";
import { listSuppliers } from "../../src/modules/suppliers/queries";
import {
  createSupplier,
  createTransactionSupplier,
  setSupplierActive,
  updateSupplier,
} from "../../src/modules/suppliers/services";
import { createUnit, setUnitActive, updateUnit } from "../../src/modules/units/services";

const directUrl = process.env["DIRECT_URL"];
if (!directUrl) throw new Error("DIRECT_URL is required");
if (process.env["STOCKFLOW_DATABASE_TARGET"] !== "development-disposable") {
  throw new Error("Refusing Phase 1B integration tests on a non-disposable database");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: directUrl }) });
const prefix = "P1B-IT-";
const marker = "stockflow-phase-1b-integration";
const admin: AuthorizedUser = {
  id: randomUUID(),
  name: "Test Admin",
  email: "p1b-admin@example.test",
  role: "ADMIN",
  isActive: true,
};
const staff: AuthorizedUser = { ...admin, role: "STAFF" };
const unique = () => randomUUID().replaceAll("-", "").slice(0, 12);

async function cleanup() {
  await db.product.deleteMany({ where: { sku: { startsWith: prefix } } });
  await db.category.deleteMany({ where: { slug: { startsWith: "p1b-it-" } } });
  await db.unitOfMeasure.deleteMany({ where: { code: { startsWith: prefix } } });
  await db.supplier.deleteMany({ where: { notes: marker } });
  await db.customer.deleteMany({ where: { notes: marker, isWalkIn: false } });
}

describe("Phase 1B master-data services", () => {
  beforeAll(async () => {
    await db.$connect();
    await seedFoundationData(db);
  });
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("creates, updates, deactivates, and rejects duplicate categories", async () => {
    const id = unique();
    const category = await createCategory({ name: `${prefix}${id}`, slug: `p1b-it-${id}` }, admin);
    const updated = await updateCategory(
      category.id,
      {
        name: `${prefix}${id} Updated`,
        slug: `p1b-it-${id}`,
        description: "Updated",
        parentId: null,
      },
      admin,
    );
    expect(updated.description).toBe("Updated");
    await expect(
      createCategory({ name: "Duplicate", slug: `p1b-it-${id}`, parentId: null }, admin),
    ).rejects.toThrow("already exists");
    expect((await setCategoryActive(category.id, false, admin)).isActive).toBe(false);
  });

  it("rejects self-parenting and category cycles", async () => {
    const parent = await createCategory(
      { name: `${prefix}Parent ${unique()}`, slug: `p1b-it-${unique()}`, parentId: null },
      admin,
    );
    const child = await createCategory(
      { name: `${prefix}Child ${unique()}`, slug: `p1b-it-${unique()}`, parentId: parent.id },
      admin,
    );
    await expect(
      updateCategory(
        parent.id,
        { name: parent.name, slug: parent.slug, parentId: parent.id },
        admin,
      ),
    ).rejects.toThrow("own parent");
    await expect(
      updateCategory(
        parent.id,
        { name: parent.name, slug: parent.slug, parentId: child.id },
        admin,
      ),
    ).rejects.toThrow("cycle");
  });

  it("requires Admin for master-data mutations", async () => {
    await expect(
      createCategory({ name: "Denied", slug: `p1b-it-${unique()}`, parentId: null }, staff),
    ).rejects.toThrow("permission");
  });

  it("normalizes UOM codes, rejects duplicates/invalid scale, and guards referenced scale changes", async () => {
    const code = `${prefix}${unique()}`.slice(0, 12);
    const unit = await createUnit(
      { code: code.toLowerCase(), name: `${prefix}Unit ${unique()}`, decimalScale: 2 },
      admin,
    );
    expect(unit.code).toBe(code.toUpperCase());
    await expect(
      createUnit({ code, name: `${prefix}Other ${unique()}`, decimalScale: 2 }, admin),
    ).rejects.toThrow("already exists");
    await expect(
      createUnit({ code: `${prefix}X`, name: `${prefix}Bad`, decimalScale: 5 }, admin),
    ).rejects.toThrow();
    const category = await createCategory(
      { name: `${prefix}Category ${unique()}`, slug: `p1b-it-${unique()}`, parentId: null },
      admin,
    );
    await createProduct(
      {
        sku: `${prefix}${unique()}`,
        name: `${prefix}Product`,
        categoryId: category.id,
        inventoryUnitId: unit.id,
        preferredSupplierId: null,
        defaultPurchasePrice: "10.1234",
        defaultSellingPrice: "20",
        lowStockThreshold: "1.25",
        description: null,
        specifications: [],
      },
      admin,
    );
    await expect(
      updateUnit(unit.id, { code: unit.code, name: unit.name, decimalScale: 3 }, admin),
    ).rejects.toThrow("cannot change");
    expect((await setUnitActive(unit.id, false, admin)).isActive).toBe(false);
  });

  it("creates and deactivates a validated flexible Product and enforces unique SKU", async () => {
    const category = await createCategory(
      { name: `${prefix}Category ${unique()}`, slug: `p1b-it-${unique()}`, parentId: null },
      admin,
    );
    const unit = await db.unitOfMeasure.findUniqueOrThrow({ where: { code: "PCS" } });
    const supplier = await createSupplier({ name: `${prefix}Supplier`, notes: marker }, admin);
    const sku = `${prefix}${unique()}`;
    const product = await createProduct(
      {
        sku: sku.toLowerCase(),
        name: `${prefix}Product`,
        categoryId: category.id,
        inventoryUnitId: unit.id,
        preferredSupplierId: supplier.id,
        defaultPurchasePrice: "10.1234",
        defaultSellingPrice: "20.50",
        lowStockThreshold: "2",
        description: "General trading item",
        specifications: [{ key: "Material Type", value: "Mixed" }],
      },
      admin,
    );
    expect(product.sku).toBe(sku.toUpperCase());
    expect(product.defaultSellingPrice?.toFixed(2)).toBe("20.50");
    expect(product.specifications).toEqual({ material_type: "Mixed" });
    await expect(
      createProduct(
        {
          sku,
          name: "Duplicate",
          categoryId: category.id,
          inventoryUnitId: unit.id,
          preferredSupplierId: null,
          defaultPurchasePrice: null,
          defaultSellingPrice: null,
          lowStockThreshold: "0",
          description: null,
          specifications: [],
        },
        admin,
      ),
    ).rejects.toThrow("already exists");
    await expect(
      createProduct(
        {
          sku: `${prefix}${unique()}`,
          name: "Bad price",
          categoryId: category.id,
          inventoryUnitId: unit.id,
          preferredSupplierId: null,
          defaultPurchasePrice: "-1",
          defaultSellingPrice: null,
          lowStockThreshold: "0",
          description: null,
          specifications: [],
        },
        admin,
      ),
    ).rejects.toThrow("negative");
    expect((await setProductActive(product.id, false, admin)).isActive).toBe(false);
  });

  it("validates Product references and UOM quantity scale without any stock field", async () => {
    const unit = await db.unitOfMeasure.findUniqueOrThrow({ where: { code: "PCS" } });
    await expect(
      createProduct(
        {
          sku: `${prefix}${unique()}`,
          name: "Missing category",
          categoryId: randomUUID(),
          inventoryUnitId: unit.id,
          preferredSupplierId: null,
          defaultPurchasePrice: null,
          defaultSellingPrice: null,
          lowStockThreshold: "0",
          description: null,
          specifications: [],
        },
        admin,
      ),
    ).rejects.toThrow("active category");
    const category = await createCategory(
      { name: `${prefix}Category ${unique()}`, slug: `p1b-it-${unique()}`, parentId: null },
      admin,
    );
    await expect(
      createProduct(
        {
          sku: `${prefix}${unique()}`,
          name: "Fractional piece",
          categoryId: category.id,
          inventoryUnitId: unit.id,
          preferredSupplierId: null,
          defaultPurchasePrice: null,
          defaultSellingPrice: null,
          lowStockThreshold: "1.5",
          description: null,
          specifications: [],
        },
        admin,
      ),
    ).rejects.toThrow("at most 0");
  });

  it("creates, updates, searches, and deactivates suppliers", async () => {
    const supplier = await createSupplier(
      {
        name: `${prefix}Supplier ${unique()}`,
        contactPerson: "Ali",
        phone: "123",
        email: "SUPPLIER@EXAMPLE.TEST",
        address: "Address",
        notes: marker,
      },
      admin,
    );
    expect(supplier.email).toBe("supplier@example.test");
    expect(
      (
        await updateSupplier(
          supplier.id,
          { name: `${supplier.name} Updated`, notes: marker },
          admin,
        )
      ).name,
    ).toContain("Updated");
    expect(
      (await listSuppliers({ search: supplier.name, page: 1 })).items.some(
        (item) => item.id === supplier.id,
      ),
    ).toBe(true);
    expect((await setSupplierActive(supplier.id, false, admin)).isActive).toBe(false);
  });

  it("creates, updates, and deactivates normal customers while protecting Walk-in", async () => {
    const customer = await createCustomer(
      { name: `${prefix}Customer ${unique()}`, email: "CUSTOMER@EXAMPLE.TEST", notes: marker },
      admin,
    );
    expect(customer.isWalkIn).toBe(false);
    expect(
      (
        await updateCustomer(
          customer.id,
          { name: `${customer.name} Updated`, notes: marker },
          admin,
        )
      ).name,
    ).toContain("Updated");
    expect((await setCustomerActive(customer.id, false, admin)).isActive).toBe(false);
    const walkIn = await db.customer.findFirstOrThrow({ where: { isWalkIn: true } });
    await expect(updateCustomer(walkIn.id, { name: "Changed" }, admin)).rejects.toThrow(
      "cannot be edited",
    );
    await expect(setCustomerActive(walkIn.id, false, admin)).rejects.toThrow(
      "cannot be deactivated",
    );
    await expect(
      db.customer.create({ data: { name: "Second Walk-in", isWalkIn: true, notes: marker } }),
    ).rejects.toBeTruthy();
  });

  it("quick-creates transaction parties without duplicates and preserves Admin authorization", async () => {
    const customerInput = {
      name: `${prefix}Quick Customer ${unique()}`,
      phone: "0300-1111111",
      notes: marker,
    };
    const supplierInput = {
      name: `${prefix}Quick Supplier ${unique()}`,
      phone: "0300-2222222",
      notes: marker,
    };

    const customer = await createTransactionCustomer(customerInput, admin);
    const supplier = await createTransactionSupplier(supplierInput, admin);
    expect(customer.isWalkIn).toBe(false);
    expect(supplier.name).toBe(supplierInput.name);
    await expect(createTransactionCustomer(customerInput, admin)).rejects.toThrow("already exists");
    await expect(createTransactionSupplier(supplierInput, admin)).rejects.toThrow("already exists");
    await expect(
      createTransactionCustomer({ ...customerInput, name: `${customerInput.name} Staff` }, staff),
    ).rejects.toThrow("permission");
    await expect(
      createTransactionSupplier({ ...supplierInput, name: `${supplierInput.name} Staff` }, staff),
    ).rejects.toThrow("permission");
  });
});
