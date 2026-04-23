import { cn } from "@/lib/utils";
import React from "react";

// ─── PageHeader ────────────────────────────────────────────────────────────────
//
// The unified top-of-page header for every dashboard page.
// Replaces the ad-hoc eyebrow + h1 pattern that is copy-pasted across pages.
//
// Usage:
//   <PageHeader
//     eyebrow="Contractor Dashboard"
//     title="Welcome back, Marcus"
//     description="3 active deals · 1 draw pending review"
//     action={<Button>Create Deal</Button>}
//   />
//
interface PageHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div>
        {eyebrow && (
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px w-5 bg-vektrum-blue flex-shrink-0" aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-blue">
              {eyebrow}
            </p>
          </div>
        )}
        <h1 className="font-display text-[2rem] sm:text-[2.25rem] font-bold tracking-[-0.03em] text-white leading-[1.05]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-white/50 leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0 self-start">
          {action}
        </div>
      )}
    </div>
  );
}

// ─── SectionHeader ─────────────────────────────────────────────────────────────
//
// The standard section label with eyebrow line used inside pages.
// Replaces the SectionLabel inline function in dashboard/page.tsx and similar.
//
// Usage:
//   <SectionHeader label="Your Deals" count={3} />
//   <SectionHeader label="Action Queue" count={2} variant="warning" />
//
interface SectionHeaderProps {
  label: string;
  count?: number;
  variant?: "default" | "warning" | "blue";
  className?: string;
  action?: React.ReactNode;
}

export function SectionHeader({
  label,
  count,
  variant = "default",
  className,
  action,
}: SectionHeaderProps) {
  const labelColor =
    variant === "warning"
      ? "text-amber-400"
      : variant === "blue"
      ? "text-vektrum-blue"
      : "text-white/40";

  const lineColor =
    variant === "warning"
      ? "bg-amber-400"
      : "bg-vektrum-blue";

  return (
    <div className={cn("mb-5 flex items-center justify-between", className)}>
      <div className="flex items-center gap-3">
        <div className={cn("h-px w-5 flex-shrink-0", lineColor)} aria-hidden="true" />
        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", labelColor)}>
          {label}
          {count !== undefined && (
            <span className="ml-2 font-mono tabular-nums text-white/25">· {count}</span>
          )}
        </p>
      </div>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
