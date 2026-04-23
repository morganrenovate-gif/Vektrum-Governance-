import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as USD currency */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format a number as a plain dollar amount (no symbol) */
export function formatMoneyPlain(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format ISO date string for display (includes time and timezone) */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Format ISO date string as a short date only (no time) — for tables and lists */
export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/** Human-readable label for deal/milestone status */
export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    active: "Active",
    completed: "Completed",
    disputed: "Disputed",
    cancelled: "Cancelled",
    not_started: "Not Started",
    in_progress: "In Progress",
    ready_for_review: "Ready for Review",
    approved: "Approved",
    released: "Released",
    pending_funding: "Pending Funding",
    funded: "Funded",
    ready_for_release: "Ready to Release",
    refunded: "Refunded",
  };
  return labels[status] ?? status;
}
