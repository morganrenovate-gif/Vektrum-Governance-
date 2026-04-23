import {
  PageHeaderSkeleton,
  SectionHeaderSkeleton,
  HealthPillsSkeleton,
  MetricStripSkeleton,
  StatTileGridSkeleton,
  TableSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

/**
 * Loading skeleton for /dashboard/admin.
 *
 * Mirrors the actual admin page structure:
 *   1. PageHeader (title + Ops Dashboard + Full Audit Log buttons)
 *   2. Admin access info card
 *   3. Operator health pills row
 *   4. Platform Overview — 6-col MetricStrip
 *   5. Admin Management section (invite form area)
 *   6. Open Disputes section (table)
 *   7. User Management table
 *   8. Platform Health tiles (3-col grid)
 *   9. Stripe Reconciliation panel
 *   10. Recent Audit Activity list
 */
export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page space-y-10">

        {/* 1. Page header with action buttons */}
        <PageHeaderSkeleton hasAction hasDescription />

        {/* 2. Admin access info card */}
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-5 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>

        {/* 3. Operator health pills */}
        <HealthPillsSkeleton count={5} />

        {/* 4. Platform Overview — 6-stat MetricStrip */}
        <section>
          <SectionHeaderSkeleton />
          <MetricStripSkeleton cols={6} />
        </section>

        {/* 5. Admin Management — invite form area */}
        <section>
          <SectionHeaderSkeleton />
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
        </section>

        {/* 6. Open Disputes queue */}
        <section>
          <SectionHeaderSkeleton />
          <TableSkeleton rows={3} cols={5} />
        </section>

        {/* 7. User Management table */}
        <section>
          <SectionHeaderSkeleton />
          <TableSkeleton rows={6} cols={5} />
        </section>

        {/* 8. Platform Health — 3-col stat tiles */}
        <section>
          <SectionHeaderSkeleton />
          <StatTileGridSkeleton count={3} smCols={3} />
          {/* AI tile full-width */}
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <Skeleton className="h-2.5 w-1/4" />
              <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
            </div>
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-2 h-2.5 w-2/3" />
          </div>
        </section>

        {/* 9. Stripe Reconciliation panel */}
        <section>
          <SectionHeaderSkeleton />
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <Skeleton className="h-3 w-40" />
            </div>
            <TableSkeleton rows={4} cols={5} />
          </div>
        </section>

        {/* 10. Recent Audit Activity */}
        <section>
          <SectionHeaderSkeleton />
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.05] last:border-0"
                style={{ opacity: 1 - i * 0.08 }}
              >
                <Skeleton className="h-2.5 w-10 flex-shrink-0" />
                <Skeleton className="h-3 w-36 flex-shrink-0" />
                <Skeleton className="h-5 w-28 rounded-full flex-shrink-0" />
                <Skeleton className="h-2.5 flex-1" />
                <Skeleton className="h-2.5 w-36 flex-shrink-0" />
              </div>
            ))}
            <div className="px-5 py-3 border-t border-white/[0.05] bg-white/[0.02]">
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
