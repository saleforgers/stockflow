import { ApplicationError } from "@/lib/errors/application-error";

export function translatePrismaError(error: unknown, conflictMessage: string): never {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2002") {
      throw new ApplicationError("CONFLICT", conflictMessage, { cause: error });
    }

    if (error.code === "P2025") {
      throw new ApplicationError("NOT_FOUND", "The requested record was not found", {
        cause: error,
      });
    }
  }

  throw error;
}
