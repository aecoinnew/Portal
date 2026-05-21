import type { ProductType, RequestStatus } from "@/lib/types/domain";

export const baseCurrency = "AED";

export function formatMoney(value: number | null | undefined, currency = baseCurrency) {
  const safeValue = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(safeValue);
}

export function formatSignedMoney(value: number | null | undefined, currency = baseCurrency) {
  const safeValue = Number(value ?? 0);
  const formatted = formatMoney(Math.abs(safeValue), currency);
  if (safeValue > 0) return `+${formatted}`;
  if (safeValue < 0) return `-${formatted}`;
  return formatted;
}

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits
  }).format(Number(value ?? 0));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function titleCase(value: string) {
  return value
    .split("_")
    .join(" ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function productTypeLabel(type: ProductType) {
  if (type === "stock") return "Equity";
  return titleCase(type);
}

export function statusTone(status: RequestStatus) {
  return {
    pending: "warning",
    approved: "info",
    rejected: "danger",
    executed: "success"
  }[status];
}
