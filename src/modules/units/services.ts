import type { AuthorizedUser } from "@/lib/auth/authorization";
import { assertMasterDataAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseCommand } from "@/lib/validation/command";
import { normalizeCode } from "@/lib/validation/normalization";
import { translatePrismaError } from "@/lib/validation/prisma-errors";

import { unitCommandSchema, type UnitCommand } from "./validation";

function unitData(command: UnitCommand) {
  return {
    code: normalizeCode(command.code),
    name: command.name.trim(),
    decimalScale: command.decimalScale,
  };
}

export async function createUnit(input: UnitCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  const command = parseCommand(unitCommandSchema, input);
  try {
    return await prisma.unitOfMeasure.create({ data: unitData(command) });
  } catch (error) {
    translatePrismaError(error, "A unit with this code or name already exists");
  }
}

export async function updateUnit(id: string, input: UnitCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  const command = parseCommand(unitCommandSchema, input);
  const current = await prisma.unitOfMeasure.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!current) throw new ApplicationError("NOT_FOUND", "Unit was not found");
  if (current.decimalScale !== command.decimalScale && current._count.products > 0) {
    throw new ApplicationError(
      "CONFLICT",
      "Decimal scale cannot change after the unit is assigned to a product",
    );
  }
  try {
    return await prisma.unitOfMeasure.update({ where: { id }, data: unitData(command) });
  } catch (error) {
    translatePrismaError(error, "A unit with this code or name already exists");
  }
}

export async function setUnitActive(id: string, isActive: boolean, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  try {
    return await prisma.unitOfMeasure.update({ where: { id }, data: { isActive } });
  } catch (error) {
    translatePrismaError(error, "Unit status could not be changed");
  }
}
