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

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700 ring-slate-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  success: "bg-green-50 text-green-700 ring-green-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  error: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
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
    draft: { variant: "neutral", label: "Draft" },
    active: { variant: "info", label: "Active" },
    completed: { variant: "success", label: "Completed" },
    disputed: { variant: "error", label: "Disputed" },
    cancelled: { variant: "neutral", label: "Cancelled" },
  };
  const entry = map[status] ?? { variant: "default", label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export function MilestoneStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    not_started: { variant: "neutral", label: "Not Started" },
    in_progress: { variant: "info", label: "In Progress" },
    ready_for_review: { variant: "warning", label: "Ready for Review" },
    approved: { variant: "success", label: "Approved" },
    released: { variant: "success", label: "Released" },
    disputed: { variant: "error", label: "Disputed" },
  };
  const entry = map[status] ?? { variant: "default", label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export function ProtectionStatusBadge({
  status,
}: {
  status: string;
}) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    pending_funding: { variant: "warning", label: "Pending Funding" },
    funded: { variant: "info", label: "Funded" },
    ready_for_release: { variant: "success", label: "Ready to Release" },
    released: { variant: "success", label: "Released" },
    refunded: { variant: "neutral", label: "Refunded" },
  };
  const entry = map[status] ?? { variant: "default", label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
