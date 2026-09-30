import { ApplicationError } from "@/lib/errors/application-error";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseBusinessDate(value: string, label: string): Date {
  if (!DATE_PATTERN.test(value)) {
    throw new ApplicationError("VALIDATION_ERROR", `${label} must be a valid date`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApplicationError("VALIDATION_ERROR", `${label} must be a valid date`);
  }
  return date;
}

export function parseInstant(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApplicationError("VALIDATION_ERROR", `${label} must be a valid date and time`);
  }
  return date;
}

export function formatBusinessDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
