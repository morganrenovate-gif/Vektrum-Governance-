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
}

// ── Brand-matched badge variants ─────────────────────────────────────────────
// info  → vektrum-blue (logo cobalt) — active / in-progress states
// success → deep green — approved / released states
// warning → warm amber — review / attention states
// error   → deep red  — disputed / blocked states
// neutral → blue-grey surface — inactive / draft states
const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-vektrum-surface-alt text-vektrum-muted ring-vektrum-border",
  neutral: "bg-vektrum-surface-alt text-vektrum-muted ring-vektrum-border",
  success: "bg-vektrum-green-bg text-vektrum-green ring-vektrum-green-border",
  warning: "bg-vektrum-amber-bg text-vektrum-amber ring-vektrum-amber-border",
  error:   "bg-vektrum-red-bg text-vektrum-red ring-vektrum-red-border",
  info:    "bg-vektrum-blue-subtle text-vektrum-blue ring-vektrum-blue-border",
};

export function Badge({
  variant = "default",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Status-aware badge helpers ───────────────────────────────────────────────

export function DealStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    draft:     { variant: "neutral", label: "Draft" },
    active:    { variant: "info",    label: "Active" },
    completed: { variant: "success", label: "Completed" },
    disputed:  { variant: "error",   label: "Disputed" },
    cancelled: { variant: "neutral", label: "Cancelled" },
  };
  const entry = map[status] ?? { variant: "default", label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export function MilestoneStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    not_started:      { variant: "neutral",  label: "Not Started" },
    in_progress:      { variant: "info",     label: "In Progress" },
    ready_for_review: { variant: "warning",  label: "Ready for Review" },
    approved:         { variant: "success",  label: "Approved" },
    released:         { variant: "success",  label: "Released" },
    disputed:         { variant: "error",    label: "Disputed" },
  };
  const entry = map[status] ?? { variant: "default", label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export function ProtectionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    pending:           { variant: "warning", label: "Pending" },
    ready_for_release: { variant: "success", label: "Ready to Release" },
    released:          { variant: "success", label: "Released" },
    disputed:          { variant: "error",   label: "Disputed" },
  };
  const entry = map[status] ?? { variant: "default", label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
