import type { AuthorizedUser } from "@/lib/auth/authorization";
import { assertMasterDataAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseCommand } from "@/lib/validation/command";
import { normalizeEmail, normalizeOptionalText } from "@/lib/validation/normalization";
import { translatePrismaError } from "@/lib/validation/prisma-errors";

import { customerCommandSchema, type CustomerCommand } from "./validation";

function customerData(input: CustomerCommand) {
  const command = parseCommand(customerCommandSchema, input);
  return {
    name: command.name.trim(),
    phone: normalizeOptionalText(command.phone),
    email: normalizeEmail(command.email),
    address: normalizeOptionalText(command.address),
    notes: normalizeOptionalText(command.notes),
  };
}

export async function createCustomer(input: CustomerCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  return prisma.customer.create({ data: { ...customerData(input), isWalkIn: false } });
}

export async function updateCustomer(id: string, input: CustomerCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  const current = await prisma.customer.findUnique({ where: { id }, select: { isWalkIn: true } });
  if (!current) throw new ApplicationError("NOT_FOUND", "Customer was not found");
  if (current.isWalkIn) {
    throw new ApplicationError("FORBIDDEN", "The system Walk-in Customer cannot be edited");
  }
  try {
    return await prisma.customer.update({ where: { id }, data: customerData(input) });
  } catch (error) {
    translatePrismaError(error, "Customer could not be updated");
  }
}

export async function setCustomerActive(id: string, isActive: boolean, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  const current = await prisma.customer.findUnique({ where: { id }, select: { isWalkIn: true } });
  if (!current) throw new ApplicationError("NOT_FOUND", "Customer was not found");
  if (current.isWalkIn) {
    throw new ApplicationError("FORBIDDEN", "The system Walk-in Customer cannot be deactivated");
  }
  return prisma.customer.update({ where: { id }, data: { isActive } });
}
