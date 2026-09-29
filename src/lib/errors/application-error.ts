export type ApplicationErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INSUFFICIENT_STOCK"
  | "INVARIANT_VIOLATION"
  | "DATABASE_ERROR";

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: ApplicationErrorCode,
    message: string,
    options?: {
      cause?: unknown;
      details?: Readonly<Record<string, unknown>>;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "ApplicationError";
    this.code = code;
    this.details = options?.details;
  }
}
