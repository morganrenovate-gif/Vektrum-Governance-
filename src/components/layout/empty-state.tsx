import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";
import type { LucideIcon } from "lucide-react";

// ─── EmptyState ────────────────────────────────────────────────────────────────
//
// Canonical empty state for lists, tables, and sections that have no data.
// Replaces ad-hoc empty state divs scattered across pages.
//
// Usage:
//   <EmptyState
//     icon={FolderOpen}
//     title="No deals yet"
//     description="Create your first deal to start tracking milestones."
//     action={{ label: "Create Deal", href: "/dashboard/deals/new" }}
//   />
//
interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  /** dashed — use inside a page section; default — standalone card */
  variant?: "default" | "dashed";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "dashed",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-8 py-12 text-center",
        variant === "dashed"
          ? "rounded-2xl border-2 border-dashed border-white/[0.07]"
          : "rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] mb-4">
        <Icon size={22} className="text-white/25" aria-hidden="true" />
      </div>
      <p className="text-[15px] font-semibold text-white/60">{title}</p>
      {description && (
        <p className="mt-2 max-w-xs text-sm text-white/35 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-1.5 text-[13px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-1.5 text-[13px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
