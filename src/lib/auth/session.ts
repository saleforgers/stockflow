import "server-only";

import { headers } from "next/headers";

import { auth } from "./auth";
import type { AuthorizedUser } from "./authorization";
import { assertRole } from "./authorization";
import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApplicationError } from "@/lib/errors/application-error";

export async function getCurrentUser(): Promise<AuthorizedUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return user?.isActive ? user : null;
}

export async function requireUser(): Promise<AuthorizedUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApplicationError("UNAUTHORIZED", "Authentication is required");
  }

  return user;
}

export async function requireRole(allowedRoles: readonly UserRole[]): Promise<AuthorizedUser> {
  const user = await requireUser();
  assertRole(user, allowedRoles);
  return user;
}
