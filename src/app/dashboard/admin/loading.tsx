import { MetricStripSkeleton, TableSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page space-y-8">
        {/* Page header */}
        <div className="space-y-2 pb-7 border-b border-white/[0.06]">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-56" />
        </div>
        {/* Stats */}
        <MetricStripSkeleton cols={4} />
        {/* Two-column panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TableSkeleton rows={5} cols={3} />
          <TableSkeleton rows={5} cols={3} />
        </div>
        {/* Main table */}
        <TableSkeleton rows={8} cols={5} />
      </div>
    </div>
  );
}
