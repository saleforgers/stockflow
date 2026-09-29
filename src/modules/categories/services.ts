import type { AuthorizedUser } from "@/lib/auth/authorization";
import { assertMasterDataAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseCommand } from "@/lib/validation/command";
import { normalizeOptionalText, slugify } from "@/lib/validation/normalization";
import { translatePrismaError } from "@/lib/validation/prisma-errors";

import { categoryCommandSchema, type CategoryCommand } from "./validation";

async function ensureValidParent(
  categoryId: string | null,
  parentId: string | null,
): Promise<void> {
  if (!parentId) return;
  if (categoryId === parentId) {
    throw new ApplicationError("VALIDATION_ERROR", "A category cannot be its own parent");
  }

  let cursor: string | null = parentId;
  const visited = new Set<string>();
  while (cursor) {
    if (visited.has(cursor) || cursor === categoryId) {
      throw new ApplicationError("VALIDATION_ERROR", "Category hierarchy cannot contain a cycle");
    }
    visited.add(cursor);
    const parent: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    if (!parent) {
      throw new ApplicationError("VALIDATION_ERROR", "Selected parent category does not exist");
    }
    cursor = parent.parentId;
  }
}

function categoryData(command: CategoryCommand) {
  return {
    name: command.name.trim(),
    slug: slugify(command.slug || command.name),
    description: normalizeOptionalText(command.description),
    parentId: command.parentId ?? null,
  };
}

export async function createCategory(input: CategoryCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  const command = parseCommand(categoryCommandSchema, input);
  await ensureValidParent(null, command.parentId ?? null);
  try {
    return await prisma.category.create({ data: categoryData(command) });
  } catch (error) {
    translatePrismaError(error, "A category with this slug already exists");
  }
}

export async function updateCategory(id: string, input: CategoryCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  const command = parseCommand(categoryCommandSchema, input);
  await ensureValidParent(id, command.parentId ?? null);
  try {
    return await prisma.category.update({ where: { id }, data: categoryData(command) });
  } catch (error) {
    translatePrismaError(error, "A category with this slug already exists");
  }
}

export async function setCategoryActive(id: string, isActive: boolean, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  try {
    return await prisma.category.update({ where: { id }, data: { isActive } });
  } catch (error) {
    translatePrismaError(error, "Category status could not be changed");
  }
}
