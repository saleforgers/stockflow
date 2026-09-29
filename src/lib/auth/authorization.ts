import type { UserRole } from "@/generated/prisma/client";
import { ApplicationError } from "@/lib/errors/application-error";

export interface AuthorizedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly isActive: boolean;
}

export function assertRole(user: AuthorizedUser, allowedRoles: readonly UserRole[]): void {
  if (!user.isActive) {
    throw new ApplicationError("UNAUTHORIZED", "Your account is inactive");
  }

  if (!allowedRoles.includes(user.role)) {
    throw new ApplicationError("FORBIDDEN", "You do not have permission to perform this action");
  }
}

export function assertMasterDataAdmin(user: AuthorizedUser): void {
  assertRole(user, ["ADMIN"]);
}
