import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for /dashboard/admin/ops.
 *
 * Mirrors the Ops Dashboard page structure:
 *   1. Back link (← Admin Dashboard)
 *   2. Page header: title + description + health status badge
 *   3. Summary strip — 4-col grid (Stuck approvals, Failed payouts, Webhook feed, Open disputes)
 *   4. Search section (icon header + search panel)
 *   5. Alert Feed section (icon header + alert list)
 *   6. Release Health section (icon header + table panel)
 *   7. Webhook Health section (icon header + table panel)
 */
export default function OpsLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* 1. Back link */}
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-3" />
          <Skeleton className="h-2.5 w-28" />
        </div>

        {/* 2. Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-3 w-72" />
          </div>
          {/* Health badge */}
          <Skeleton className="h-9 w-28 rounded-xl flex-shrink-0" />
        </div>

        {/* 3. Summary strip — 4 stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-4 py-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-3.5 w-3.5 rounded-sm flex-shrink-0" />
              </div>
              <Skeleton className="h-7 w-10" />
            </div>
          ))}
        </div>

        {/* 4. Search section */}
        <section>
          <OpsIconHeader labelWidth="w-12" descWidth="w-56" />
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-4">
            <div className="flex gap-3">
              <Skeleton className="h-9 flex-1 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
          </div>
        </section>

        {/* 5. Alert Feed section */}
        <section>
          <OpsIconHeader labelWidth="w-20" descWidth="w-64" />
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.05] last:border-0"
                style={{ opacity: 1 - i * 0.12 }}
              >
                <Skeleton className="h-5 w-5 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
                <Skeleton className="h-2.5 w-24 flex-shrink-0" />
              </div>
            ))}
          </div>
        </section>

        {/* 6. Release Health section */}
        <section>
          <OpsIconHeader labelWidth="w-28" descWidth="w-60" />
          <TableSkeleton rows={4} cols={5} />
        </section>

        {/* 7. Webhook Health section */}
        <section>
          <OpsIconHeader labelWidth="w-32" descWidth="w-72" />
          <TableSkeleton rows={3} cols={4} />
        </section>

      </div>
    </div>
  );
}

/** Mirrors the SectionHeader style used on the Ops page: icon box + title + description */
function OpsIconHeader({
  labelWidth,
  descWidth,
}: {
  labelWidth: string;
  descWidth: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
      <div className="space-y-1.5">
        <Skeleton className={`h-3.5 ${labelWidth}`} />
        <Skeleton className={`h-2.5 ${descWidth}`} />
      </div>
    </div>
  );
}
