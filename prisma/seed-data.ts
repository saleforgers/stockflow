import type { PrismaClient } from "../src/generated/prisma/client";

export const foundationUnits = [
  { code: "PCS", name: "Piece", decimalScale: 0 },
  { code: "SHEET", name: "Sheet", decimalScale: 0 },
  { code: "KG", name: "Kilogram", decimalScale: 3 },
  { code: "M", name: "Meter", decimalScale: 3 },
  { code: "FT", name: "Foot", decimalScale: 3 },
  { code: "BOX", name: "Box", decimalScale: 0 },
  { code: "PACK", name: "Pack", decimalScale: 0 },
  { code: "SET", name: "Set", decimalScale: 0 },
  { code: "ROLL", name: "Roll", decimalScale: 0 },
] as const;

export const foundationPaymentMethods = [
  { code: "CASH", name: "Cash" },
  { code: "BANK_TRANSFER", name: "Bank Transfer" },
  { code: "CHEQUE", name: "Cheque" },
  { code: "OTHER", name: "Other" },
] as const;

export const foundationExpenseCategories = [
  "Freight / Carriage",
  "Loading / Unloading",
  "Transportation",
  "Medical",
  "Grocery",
  "Utilities",
  "Miscellaneous",
] as const;

export const WALK_IN_CUSTOMER_ID = "00000000-0000-4000-8000-000000000001";

export async function seedFoundationData(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(
    async (transaction) => {
      await transaction.inventoryLocation.updateMany({
        where: { isDefault: true, code: { not: "MAIN" } },
        data: { isDefault: false },
      });

      await transaction.inventoryLocation.upsert({
        where: { code: "MAIN" },
        update: { name: "Main Inventory", isDefault: true, isActive: true },
        create: { code: "MAIN", name: "Main Inventory", isDefault: true, isActive: true },
      });

      for (const unit of foundationUnits) {
        await transaction.unitOfMeasure.upsert({
          where: { code: unit.code },
          update: { name: unit.name, decimalScale: unit.decimalScale, isActive: true },
          create: { ...unit, isActive: true },
        });
      }

      for (const method of foundationPaymentMethods) {
        await transaction.paymentMethod.upsert({
          where: { code: method.code },
          update: { name: method.name, isActive: true },
          create: { ...method, isActive: true },
        });
      }

      for (const name of foundationExpenseCategories) {
        await transaction.expenseCategory.upsert({
          where: { name },
          update: { isActive: true },
          create: { name, isActive: true },
        });
      }

      await transaction.customer.upsert({
        where: { id: WALK_IN_CUSTOMER_ID },
        update: { name: "Walk-in Customer", isWalkIn: true, isActive: true },
        create: {
          id: WALK_IN_CUSTOMER_ID,
          name: "Walk-in Customer",
          isWalkIn: true,
          isActive: true,
          notes: "Controlled system customer. Sales must be fully paid at posting.",
        },
      });
    },
    { maxWait: 30_000, timeout: 30_000 },
  );
}
