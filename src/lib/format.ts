import { decimal, type DecimalInput } from "@/lib/decimal/decimal";

export function formatPkr(value: DecimalInput): string {
  const fixed = decimal(value).toFixed(2);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `PKR ${grouped}.${fraction}`;
}

export function formatQuantity(value: DecimalInput): string {
  return decimal(value)
    .toFixed()
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function currentBusinessDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function karachiDateTimeInput(value: Date): string {
  const shifted = new Date(value.getTime() + 5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}
