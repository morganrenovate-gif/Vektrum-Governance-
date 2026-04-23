import { cn } from "@/lib/utils";
import React from "react";

// ─── Base skeleton ────────────────────────────────────────────────────────────
//
// animate-pulse with a very subtle dark-surface tint.
// bg-white/[0.06] reads as a low-opacity shimmer on surface-2/surface-3 cards.

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-white/[0.06]", className)}
      style={style}
      aria-hidden="true"
    />
  );
}

// ─── Page header skeleton ─────────────────────────────────────────────────────
//
// Mirrors the PageHeader layout component structure:
//   eyebrow (vertical bar + tiny label) → big title → description → separator

export function PageHeaderSkeleton({
  hasAction = false,
  hasDescription = true,
}: {
  hasAction?: boolean;
  hasDescription?: boolean;
}) {
  return (
    <div className="space-y-0" aria-hidden="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-7">
        <div className="space-y-2.5">
          {/* Eyebrow row */}
          <div className="flex items-center gap-2.5">
            <div className="h-4 w-[3px] rounded-full bg-white/[0.12] flex-shrink-0" />
            <Skeleton className="h-2.5 w-32" />
          </div>
          {/* Title */}
          <Skeleton className="h-9 w-64" />
          {/* Description */}
          {hasDescription && <Skeleton className="h-3.5 w-80 mt-0.5" />}
        </div>
        {hasAction && (
          <div className="flex-shrink-0 self-end">
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        )}
      </div>
      {/* Bottom separator */}
      <div className="h-px w-full bg-white/[0.06]" />
    </div>
  );
}

// ─── Section header skeleton ──────────────────────────────────────────────────
//
// Mirrors the SectionHeader layout component:
//   short bar → tiny label → full-width filler rule

export function SectionHeaderSkeleton({
  wide = false,
}: {
  wide?: boolean;
}) {
  return (
    <div className="mb-5 flex items-center gap-3" aria-hidden="true">
      <div className="h-px w-7 flex-shrink-0 bg-white/[0.12]" />
      <Skeleton className={cn("h-2.5", wide ? "w-36" : "w-24")} />
      <div className="h-px flex-1 bg-white/[0.05]" />
    </div>
  );
}

// ─── Filter tabs skeleton ─────────────────────────────────────────────────────
//
// Horizontal tab bar — used on the audit log page and any filtered table view.

export function FilterTabsSkeleton({ count = 6 }: { count?: number }) {
  const widths = ["w-10", "w-14", "w-16", "w-20", "w-14", "w-12", "w-14", "w-10"];
  return (
    <div className="flex gap-2 flex-wrap" aria-hidden="true">
      {/* First tab looks "active" — slightly wider/brighter */}
      <Skeleton className="h-8 w-12 rounded-lg bg-white/[0.10]" />
      {Array.from({ length: count - 1 }).map((_, i) => (
        <Skeleton key={i} className={cn("h-8 rounded-lg", widths[(i + 1) % widths.length])} />
      ))}
    </div>
  );
}

// ─── Health pills skeleton ────────────────────────────────────────────────────
//
// Admin dashboard operator health status pills row.

export function HealthPillsSkeleton({ count = 5 }: { count?: number }) {
  const widths = ["w-40", "w-36", "w-32", "w-44", "w-40", "w-36"];
  return (
    <div className="flex flex-wrap gap-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("h-7 rounded-full", widths[i % widths.length])} />
      ))}
    </div>
  );
}

// ─── Stat tile grid skeleton ──────────────────────────────────────────────────
//
// Grid of standalone admin/ops stat tiles (not the inline MetricStrip).
// Used in admin platform health, ops summary cards, etc.

export function StatTileGridSkeleton({
  count = 3,
  smCols = 3,
}: {
  count?: number;
  smCols?: number;
}) {
  return (
    <div
      className={cn(`grid grid-cols-2 gap-3`, `sm:grid-cols-${smCols}`)}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-5"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <Skeleton className="h-2.5 w-1/3" />
            <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
          </div>
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="mt-2 h-2.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}

// ─── Intel briefing skeleton ──────────────────────────────────────────────────
//
// Funder dashboard weekly intelligence briefing card.

export function IntelBriefingSkeleton() {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden"
      aria-hidden="true"
    >
      {/* Header with accent bar */}
      <div className="border-l-4 border-l-white/[0.08] px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-sm flex-shrink-0" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      {/* Bullet points */}
      <ul className="px-5 py-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Skeleton
              className="mt-[7px] h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ opacity: 1 - i * 0.08 }}
            />
            <Skeleton className="h-3 flex-1" style={{ opacity: 1 - i * 0.1 }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Action banner skeleton ───────────────────────────────────────────────────
//
// Next Best Action / NBA strip on contractor and funder dashboards.
// Has a left border accent, a label + description, and a CTA button.

export function ActionBannerSkeleton() {
  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-4 flex items-center justify-between border-l-4 border-l-white/[0.08]"
      aria-hidden="true"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Skeleton className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0" />
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>
      <Skeleton className="h-8 w-24 rounded-xl ml-4 flex-shrink-0" />
    </div>
  );
}

// ─── Draw review panel skeleton ───────────────────────────────────────────────
//
// Contractor dashboard draw review status panel.
// Has an accent-bar header and a list of milestone rows with CTA buttons.

export function DrawReviewPanelSkeleton() {
  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden shadow-card"
      aria-hidden="true"
    >
      {/* Panel header with blue accent bar */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <Skeleton className="h-px w-5 rounded-none" />
        <Skeleton className="h-2.5 w-36" />
      </div>
      <div className="p-4 space-y-2.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-surface-3 px-4 py-3.5"
            style={{ opacity: i === 0 ? 1 : 0.65 }}
          >
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20 rounded-xl flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Document list skeleton ───────────────────────────────────────────────────
//
// Used in the contractor documents page. Shows file icon + name + meta + action.

export function DocumentListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden"
      aria-hidden="true"
    >
      {/* Table header */}
      <div className="flex items-center gap-6 border-b border-white/[0.06] bg-white/[0.015] px-5 py-2.5">
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="h-2.5 w-1/5" />
        <Skeleton className="h-2.5 w-20 ml-auto" />
        <Skeleton className="h-2.5 w-14" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-0"
          style={{ opacity: 1 - i * 0.06 }}
        >
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-2.5 w-24 flex-shrink-0" />
          <Skeleton className="h-2.5 w-20 flex-shrink-0" />
          <Skeleton className="h-7 w-16 rounded-lg flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Receipt detail skeleton ──────────────────────────────────────────────────
//
// Full receipt document skeleton: back link → document card with amount hero
// + key-value rows + action footer.

export function ReceiptDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl" aria-hidden="true">
      {/* Back navigation */}
      <Skeleton className="h-3.5 w-32" />

      {/* Receipt card */}
      <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
        {/* Header: reference ID + status badge */}
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-5 w-56" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
        </div>
        {/* Amount hero */}
        <div className="px-6 py-8 text-center border-b border-white/[0.06]">
          <Skeleton className="h-3 w-24 mx-auto mb-3" />
          <Skeleton className="h-12 w-52 mx-auto" />
          <Skeleton className="mt-3 h-3 w-40 mx-auto" />
        </div>
        {/* Detail key-value rows */}
        <div className="divide-y divide-white/[0.05]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-3.5 flex items-center justify-between gap-4">
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="h-2.5 w-36" />
            </div>
          ))}
        </div>
        {/* Print/Download footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3 justify-end bg-white/[0.02]">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Card skeleton ────────────────────────────────────────────────────────────

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-surface-2 p-5 shadow-card",
        className
      )}
      aria-hidden="true"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}

// ─── Deal card skeleton ───────────────────────────────────────────────────────

export function DealCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden"
      aria-hidden="true"
    >
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1 text-center">
              <Skeleton className="h-2.5 w-full rounded" />
              <Skeleton className="h-4 w-4/5 mx-auto rounded" />
            </div>
          ))}
        </div>
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
    </div>
  );
}

// ─── Metric strip skeleton ────────────────────────────────────────────────────
//
// Mirrors the MetricStrip layout component: a single row of evenly-divided
// stat blocks separated by vertical rules.

export function MetricStripSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div
      className="flex divide-x divide-white/[0.06] rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden"
      aria-hidden="true"
    >
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex-1 px-5 py-4 space-y-2">
          <Skeleton className="h-2.5 w-1/2" />
          <Skeleton className="h-7 w-3/4" />
        </div>
      ))}
    </div>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────
//
// Generic table placeholder. Header row + body rows with staggered widths.

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden"
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex gap-4 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2.5">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 border-b border-white/[0.035] px-4 py-3 last:border-0"
          style={{ opacity: 1 - i * 0.07 }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className="h-3.5 flex-1"
              style={{ opacity: 1 - j * 0.08 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────
//
// Full-page skeleton for /dashboard — role-agnostic since Next.js streaming
// runs before auth session is known. Shows a plausible dashboard layout that
// works visually for contractor, funder, and admin initial renders.
//
// IMPORTANT: Callers must wrap this with  <div className="min-h-screen bg-surface-0">
// since DashboardSkeleton itself is a content-only skeleton.

export function DashboardSkeleton() {
  return (
    <div className="dash-page space-y-10" aria-label="Loading dashboard…">
      {/* Page header */}
      <PageHeaderSkeleton hasAction hasDescription={false} />

      {/* Intelligence briefing / NBA action strip */}
      <ActionBannerSkeleton />

      {/* Metric strip — 4 stats */}
      <MetricStripSkeleton cols={4} />

      {/* Draw review / capital panel */}
      <DrawReviewPanelSkeleton />

      {/* Deals section */}
      <div className="space-y-5">
        <SectionHeaderSkeleton />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <DealCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Milestone card skeleton ──────────────────────────────────────────────────
//
// Mirrors the MilestoneCard component: title + amount + status badge + action.

export function MilestoneCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden border-l-[3px] border-l-white/[0.08]"
      aria-hidden="true"
    >
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <div className="space-y-2 items-end text-right">
            <Skeleton className="h-2.5 w-12 ml-auto" />
            <Skeleton className="h-6 w-24 ml-auto" />
            <Skeleton className="h-8 w-28 ml-auto rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Money summary skeleton ───────────────────────────────────────────────────
//
// Used inside deal detail page — total / funded / released breakdown.

export function MoneySummarySkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2.5 w-1/2" />
            <Skeleton className="h-7 w-4/5" />
          </div>
        ))}
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
    </div>
  );
}
