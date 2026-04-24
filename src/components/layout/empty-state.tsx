import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";
import type { LucideIcon } from "lucide-react";

// ─── EmptyState ────────────────────────────────────────────────────────────────
//
// Intentional empty state — not a placeholder, a deliberate system state.
// Design principles:
//   - Icon: contained in a structured icon box, not floating
//   - Title: clear statement of state, not apology
//   - Description: actionable context, max 1 sentence
//   - CTA: secondary weight — never as prominent as primary page actions
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
        "flex flex-col items-center justify-center px-8 py-14 text-center",
        variant === "dashed"
          ? "rounded-xl border border-dashed border-white/[0.08]"
          : "rounded-xl border border-white/[0.08] bg-surface-2 shadow-card",
        className
      )}
    >
      {/* Icon */}
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] mb-4">
        <Icon size={20} className="text-white/65" aria-hidden="true" />
      </div>

      {/* Text */}
      <p className="text-[14px] font-semibold text-white/90">{title}</p>
      {description && (
        <p className="mt-2 max-w-[280px] text-[13px] text-white/70 leading-relaxed">
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-white/[0.16] bg-white/[0.05] px-4 py-1.5 text-[12px] font-medium text-white/85 hover:bg-white/[0.1] hover:text-white hover:border-white/[0.24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-white/[0.16] bg-white/[0.05] px-4 py-1.5 text-[12px] font-medium text-white/85 hover:bg-white/[0.1] hover:text-white hover:border-white/[0.24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
