import { cn } from "@/lib/utils";

// ─── Base skeleton ────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/[0.06]",
        className
      )}
      aria-hidden="true"
    />
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
        <div key={i} className="flex gap-4 border-b border-white/[0.035] px-4 py-3 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-3.5 flex-1" style={{ opacity: 1 - j * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="dash-page space-y-10" aria-label="Loading dashboard…">
      {/* Page title */}
      <div className="space-y-2 pb-7 border-b border-white/[0.06]">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-64" />
      </div>
      {/* Metric strip */}
      <MetricStripSkeleton cols={4} />
      {/* Deal cards */}
      <div className="space-y-4">
        <Skeleton className="h-3 w-24" />
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
