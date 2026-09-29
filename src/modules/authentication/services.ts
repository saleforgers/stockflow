import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseCommand } from "@/lib/validation/command";

import { firstAdminSchema, type FirstAdminInput } from "./validation";

export async function bootstrapFirstAdmin(
  input: FirstAdminInput,
  prisma: PrismaClient,
): Promise<{ id: string }> {
  const command = parseCommand(firstAdminSchema, input);
  const passwordHash = await hashPassword(command.password);

  return prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('stockflow:first-admin-bootstrap'))`;

      if ((await transaction.user.count({ where: { role: "ADMIN" } })) > 0) {
        throw new ApplicationError("CONFLICT", "An Admin already exists; bootstrap was refused");
      }

      const userId = randomUUID();
      const accountId = randomUUID();
      const user = await transaction.user.create({
        data: {
          id: userId,
          name: command.name,
          email: command.email,
          emailVerified: true,
          role: "ADMIN",
          isActive: true,
          accounts: {
            create: {
              id: accountId,
              accountId: userId,
              providerId: "credential",
              password: passwordHash,
            },
          },
        },
        select: { id: true },
      });

      return user;
    },
    {
      isolationLevel: "Serializable",
      maxWait: 15_000,
      timeout: 30_000,
    },
  );
}
