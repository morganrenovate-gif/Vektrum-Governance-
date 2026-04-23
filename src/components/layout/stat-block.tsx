import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";

// ─── StatBlock ─────────────────────────────────────────────────────────────────
//
// The canonical stat tile for all dashboard stat strips.
// Replaces: StatTile, MoneyStatTile, inline stat components in demo pages,
//           and the separate MoneyTile pattern used in demo-live pages.
//
// Usage:
//   <StatBlock label="Total Deals" value="12" />
//   <StatBlock label="Total Funded" value="$4,200,000" money />
//   <StatBlock label="Pending Review" value={3} alert />
//   <StatBlock label="Active Deals" value="7" href="/dashboard/deals" />
//
interface StatBlockProps {
  label: string;
  value: React.ReactNode;
  subvalue?: string;
  /** Amber border treatment — draws attention to an urgent metric */
  alert?: boolean;
  /** Link — makes the entire block a clickable navigation target */
  href?: string;
  /** Use monospaced font for money amounts */
  money?: boolean;
  className?: string;
}

export function StatBlock({
  label,
  value,
  subvalue,
  alert = false,
  href,
  money = false,
  className,
}: StatBlockProps) {
  const inner = (
    <div
      className={cn(
        "rounded-2xl border bg-surface-2 px-5 py-5 shadow-card transition-all duration-200",
        alert
          ? "border-amber-500/30 hover:border-amber-500/50"
          : "border-white/[0.08] hover:border-white/[0.14]",
        href && "hover:-translate-y-0.5 hover:shadow-card-hover cursor-pointer",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-[1.875rem] font-bold leading-none tabular-nums tracking-[-0.02em]",
          alert ? "text-amber-400" : "text-white",
          money && "font-mono tracking-tight"
        )}
      >
        {value}
      </p>
      {subvalue && (
        <p className="mt-1.5 text-[11px] text-white/30">{subvalue}</p>
      )}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}
