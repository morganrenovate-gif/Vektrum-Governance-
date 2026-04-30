import {
  PageHeaderSkeleton,
  FilterTabsSkeleton,
  TableSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

/**
 * Loading skeleton for /dashboard/audit.
 *
 * Mirrors the actual audit log page structure:
 *   1. PageHeader (eyebrow + title + description)
 *   2. Compliance notice bar
 *   3. Category filter tabs (All, Users, Deals, Milestones, Payments, Admin, Disputes, AI)
 *   4. Filter bar (role select + search input + Apply button)
 *   5. Audit table with header + rows
 */
export default function AuditLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page space-y-6">

        {/* 1. Page header */}
        <PageHeaderSkeleton hasDescription />

        {/* 2. Compliance notice bar */}
        <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <Skeleton className="h-3.5 w-3.5 rounded-sm flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-4/5" />
          </div>
        </div>

        {/* 3. Category filter tabs — 8 tabs */}
        <FilterTabsSkeleton count={8} />

        {/* 4. Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-72 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>

        {/* 5. Audit table — 6 cols (seq, timestamp, actor, action, entity, details) */}
        <TableSkeleton rows={10} cols={6} />

      </div>
    </div>
  );
}
