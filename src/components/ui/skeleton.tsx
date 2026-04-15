import { cn } from "@/lib/utils";

/**
 * Skeleton loading components for async surfaces.
 *
 * In financial products, skeleton states are a hygiene expectation —
 * their absence creates the worst possible feeling: "Is my money still there?"
 * Every async surface in Vektrum must use these while loading.
 */

// ─── Base skeleton ────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-vektrum-surface-alt",
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
        "rounded-lg border border-vektrum-border bg-vektrum-surface p-5 shadow-sm",
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
      className="rounded-lg border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden"
      aria-hidden="true"
    >
      <div className="px-5 py-4 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        {/* Money row */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1 text-center">
              <Skeleton className="h-2.5 w-full rounded" />
              <Skeleton className="h-4 w-4/5 mx-auto rounded" />
            </div>
          ))}
        </div>
        {/* Progress bar */}
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
    </div>
  );
}

// ─── Stat tile skeleton ───────────────────────────────────────────────────────

export function StatTileSkeleton() {
  return (
    <div
      className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-4 shadow-sm"
      aria-hidden="true"
    >
      <Skeleton className="h-2.5 w-1/2 mb-2" />
      <Skeleton className="h-8 w-3/4" />
    </div>
  );
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="page-container section space-y-8" aria-label="Loading dashboard…">
      {/* Stat tiles row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <StatTileSkeleton key={i} />
        ))}
      </div>
      {/* Deal cards */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-24 mb-4" />
        {[0, 1, 2].map((i) => (
          <DealCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ─── Milestone card skeleton ──────────────────────────────────────────────────

export function MilestoneCardSkeleton() {
  return (
    <div
      className="rounded-lg border border-vektrum-border bg-vektrum-surface shadow-xs overflow-hidden"
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
            <Skeleton className="h-8 w-28 ml-auto rounded-md" />
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
      <Skeleton className="h-4 w-full rounded-full" />
    </div>
  );
}
