import type { AuthorizedUser } from "@/lib/auth/authorization";
import { assertMasterDataAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseCommand } from "@/lib/validation/command";
import { normalizeEmail, normalizeOptionalText } from "@/lib/validation/normalization";
import { translatePrismaError } from "@/lib/validation/prisma-errors";

import { supplierCommandSchema, type SupplierCommand } from "./validation";

function supplierData(input: SupplierCommand) {
  const command = parseCommand(supplierCommandSchema, input);
  return {
    name: command.name.trim(),
    contactPerson: normalizeOptionalText(command.contactPerson),
    phone: normalizeOptionalText(command.phone),
    email: normalizeEmail(command.email),
    address: normalizeOptionalText(command.address),
    notes: normalizeOptionalText(command.notes),
  };
}

export async function createSupplier(input: SupplierCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  return prisma.supplier.create({ data: supplierData(input) });
}

export async function createTransactionSupplier(input: SupplierCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  const data = supplierData(input);
  const duplicate = await prisma.supplier.findFirst({
    where: {
      isActive: true,
      name: { equals: data.name, mode: "insensitive" },
      phone: data.phone,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ApplicationError(
      "CONFLICT",
      "A supplier with this name and phone already exists. Select the existing supplier instead.",
    );
  }
  return prisma.supplier.create({ data });
}

export async function updateSupplier(id: string, input: SupplierCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  try {
    return await prisma.supplier.update({ where: { id }, data: supplierData(input) });
  } catch (error) {
    translatePrismaError(error, "Supplier could not be updated");
  }
}

export async function setSupplierActive(id: string, isActive: boolean, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  try {
    return await prisma.supplier.update({ where: { id }, data: { isActive } });
  } catch (error) {
    translatePrismaError(error, "Supplier status could not be changed");
  }
}
