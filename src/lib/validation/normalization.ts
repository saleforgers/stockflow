import { ApplicationError } from "@/lib/errors/application-error";

export function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replaceAll(/\s+/g, "-");
}

export function normalizeSku(value: string): string {
  return normalizeCode(value);
}

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  if (!slug) {
    throw new ApplicationError("VALIDATION_ERROR", "A valid category slug could not be created");
  }

  return slug;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  return normalizeOptionalText(value)?.toLowerCase() ?? null;
}
