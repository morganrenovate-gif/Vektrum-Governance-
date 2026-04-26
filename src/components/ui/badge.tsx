"use client";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  /** Light variant for use inside light-section marketing pages */
  context?: "dark" | "light";
}

// ── Dark-context badge variants (default — used on navy backgrounds) ──────────
// These match the established status badge language from the homepage hero:
//   success  → emerald-500 family
//   error    → red-500 family
//   info     → vektrum-blue family
//   warning  → amber family (using Tailwind amber, not light-mode token)
//   neutral  → white/[0.06] family
const darkVariantClasses: Record<BadgeVariant, string> = {
  default: "bg-white/[0.06] text-white/50 ring-white/[0.08]",
  neutral: "bg-white/[0.06] text-white/50 ring-white/[0.08]",
  success: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  error:   "bg-red-500/10 text-red-400 ring-red-500/20",
  info:    "bg-vektrum-blue/20 text-blue-300 ring-vektrum-blue/30",
};

// ── Light-context badge variants (for marketing / light section use) ──────────
const lightVariantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-3 text-white/55 ring-white/[0.08]",
  neutral: "bg-surface-3 text-white/55 ring-white/[0.08]",
  success: "bg-emerald-500/[0.08] text-emerald-400 ring-emerald-500/20",
  warning: "bg-amber-500/[0.08] text-amber-400 ring-amber-500/20",
  error:   "bg-red-500/[0.08] text-red-400 ring-red-500/20",
  info:    "bg-vektrum-blue/20 text-blue-300 ring-vektrum-blue/30",
};

export function Badge({
  variant = "default",
  children,
  className,
  context = "dark",
}: BadgeProps) {
  const variantClasses = context === "dark" ? darkVariantClasses : lightVariantClasses;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.07em] ring-1 ring-inset",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Status-aware badge helpers ───────────────────────────────────────────────
export function DealStatusBadge({ status, context = "dark" }: { status: string; context?: "dark" | "light" }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    draft:       { variant: "neutral", label: "Draft" },
    active:      { variant: "info",    label: "Active" },
    in_progress: { variant: "info",    label: "In Progress" },
    completed:   { variant: "success", label: "Completed" },
    disputed:    { variant: "error",   label: "Disputed" },
    cancelled:   { variant: "neutral", label: "Cancelled" },
    frozen:      { variant: "error",   label: "Frozen" },
  };
  const entry = map[status] ?? { variant: "default", label: status };
  return <Badge variant={entry.variant} context={context}>{entry.label}</Badge>;
}

export function MilestoneStatusBadge({ status, context = "dark" }: { status: string; context?: "dark" | "light" }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    not_started:      { variant: "neutral",  label: "Not Started" },
    in_progress:      { variant: "info",     label: "In Progress" },
    ready_for_review: { variant: "warning",  label: "Ready for Review" },
    approved:         { variant: "success",  label: "Approved" },
    released:         { variant: "success",  label: "Released" },
    disputed:         { variant: "error",    label: "Disputed" },
  };
  const entry = map[status] ?? { variant: "default", label: status };
  return <Badge variant={entry.variant} context={context}>{entry.label}</Badge>;
}

export function ProtectionStatusBadge({ status, context = "dark" }: { status: string; context?: "dark" | "light" }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    pending:           { variant: "warning", label: "Pending" },
    ready_for_release: { variant: "success", label: "Ready to Release" },
    released:          { variant: "success", label: "Released" },
    disputed:          { variant: "error",   label: "Disputed" },
  };
  const entry = map[status] ?? { variant: "default", label: status };
  return <Badge variant={entry.variant} context={context}>{entry.label}</Badge>;
}