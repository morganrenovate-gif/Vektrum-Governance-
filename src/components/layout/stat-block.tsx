import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";

// ─── StatBlock ─────────────────────────────────────────────────────────────────
//
// The canonical stat tile for all dashboard stat strips.
// Design principles:
//   - Numbers displayed in monospaced font — tabular, precise, financial
//   - Labels use uppercase tracking — section-header weight, not decorative
//   - Alert state uses amber border treatment — draws attention without noise
//   - Trend indicator: optional delta from previous period
//
// Variants:
//   default    — floating card with border (individual placement)
//   inline     — borderless, for use inside a .metric-strip container
//
interface StatBlockProps {
  label: string;
  value: React.ReactNode;
  subvalue?: string;
  /** Delta string, e.g. "+12%" or "-$4k". Positive renders emerald, negative red. */
  trend?: string;
  /** Amber border — draws attention to an urgent metric */
  alert?: boolean;
  /** Link — makes the entire block a clickable navigation target */
  href?: string;
  /** Use monospaced font for money/numeric amounts */
  money?: boolean;
  /** Suppress the card shell — render as plain content (inside MetricStrip) */
  inline?: boolean;
  className?: string;
}

function TrendIndicator({ trend }: { trend: string }) {
  const isPositive = trend.startsWith("+");
  const isNegative = trend.startsWith("-");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
        isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-white/75"
      )}
    >
      {trend}
    </span>
  );
}

export function StatBlock({
  label,
  value,
  subvalue,
  trend,
  alert = false,
  href,
  money = false,
  inline = false,
  className,
}: StatBlockProps) {
  const content = (
    <div
      className={cn(
        inline
          ? "px-5 py-4"
          : cn(
              "rounded-xl border bg-surface-2 px-5 py-5 shadow-card transition-all duration-200",
              alert
                ? "border-amber-500/25 hover:border-amber-500/40"
                : "border-white/[0.08] hover:border-white/[0.14]",
              href && "hover:-translate-y-0.5 hover:shadow-card-hover cursor-pointer"
            ),
        className
      )}
    >
      {/* Label row */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/65 leading-none">
          {label}
        </p>
        {alert && (
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        )}
      </div>

      {/* Value */}
      <p
        className={cn(
          "leading-none",
          alert ? "text-amber-400" : "text-white",
          money
            ? "font-mono font-bold tabular-nums tracking-tight text-[1.625rem]"
            : "font-display font-bold tracking-[-0.02em] text-[1.625rem]"
        )}
      >
        {value}
      </p>

      {/* Subvalue / trend row */}
      {(subvalue || trend) && (
        <div className="mt-2 flex items-center gap-2">
          {subvalue && (
            <p className="text-[11px] text-white/65 truncate">{subvalue}</p>
          )}
          {trend && <TrendIndicator trend={trend} />}
        </div>
      )}
    </div>
  );

  return href ? <Link href={href} className="block">{content}</Link> : content;
}

// ─── MetricStrip ──────────────────────────────────────────────────────────────
//
// A horizontal bar of key metrics divided by vertical separators.
// More data-dense and institutional than floating cards.
// Used when 3–6 related metrics belong in a single visual unit.
//
// Usage:
//   <MetricStrip>
//     <StatBlock inline label="Total Funded" value="$4.2M" money />
//     <StatBlock inline label="Released" value="$1.8M" money />
//     <StatBlock inline label="Pending" value={3} alert />
//   </MetricStrip>
//
interface MetricStripProps {
  children: React.ReactNode;
  className?: string;
}

export function MetricStrip({ children, className }: MetricStripProps) {
  return (
    <div
      className={cn(
        "flex divide-x divide-white/[0.06] rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden",
        className
      )}
    >
      {React.Children.map(children, (child) => (
        <div className="flex-1 min-w-0">{child}</div>
      ))}
    </div>
  );
}
