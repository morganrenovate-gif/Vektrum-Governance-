import { cn } from "@/lib/utils";
import React from "react";

// ─── PageHeader ────────────────────────────────────────────────────────────────
//
// Institutional-grade page header for all dashboard pages.
// Design principles:
//   - Eyebrow: tight uppercase label with vertical bar accent
//   - Title: large, heavy, authority-first typography
//   - Separator: full-width hairline below header creates clear page division
//   - Action: always right-aligned, never competes with title
//
interface PageHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Omit the bottom separator (use when the next element has its own top border) */
  noSeparator?: boolean;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  noSeparator = false,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-0", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-7">
        <div className="space-y-2.5">
          {eyebrow && (
            <div className="flex items-center gap-2.5">
              {/* Vertical bar accent — more structural than horizontal line */}
              <div className="h-4 w-[3px] rounded-full bg-vektrum-blue flex-shrink-0" aria-hidden="true" />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-vektrum-blue">
                {eyebrow}
              </p>
            </div>
          )}
          <h1 className="type-page-title">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-white/75 leading-relaxed max-w-2xl mt-0.5">
              {description}
            </p>
          )}
        </div>
        {action && (
          <div className="flex-shrink-0 self-end sm:pb-0.5">
            {action}
          </div>
        )}
      </div>
      {!noSeparator && (
        <div className="h-px w-full bg-white/[0.06]" aria-hidden="true" />
      )}
    </div>
  );
}

// ─── SectionHeader ─────────────────────────────────────────────────────────────
//
// Section-level label. Institutional: full-width rule with embedded label.
// Replaces the previous tiny-line + text pattern with a more structural element.
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
      : "text-white/65";

  const barColor =
    variant === "warning"
      ? "bg-amber-400"
      : variant === "blue"
      ? "bg-vektrum-blue"
      : "bg-white/[0.12]";

  return (
    <div className={cn("mb-5 flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Full-width separator with label — reads as a genuine section break */}
        <div className={cn("h-px w-7 flex-shrink-0", barColor)}
             aria-hidden="true" />
        <p className={cn("text-[10px] font-bold uppercase tracking-[0.16em] whitespace-nowrap", labelColor)}>
          {label}
          {count !== undefined && (
            <span className="ml-2.5 font-mono tabular-nums font-normal text-white/65">
              {count}
            </span>
          )}
        </p>
        <div className={cn("h-px flex-1", variant === "default" ? "bg-white/[0.05]" : "bg-transparent")}
             aria-hidden="true" />
      </div>
      {action && (
        <div className="flex-shrink-0">{action}</div>
      )}
    </div>
  );
}
