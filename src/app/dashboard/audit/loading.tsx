import { MetricStripSkeleton, TableSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function AuditLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page space-y-8">
        {/* Page header */}
        <div className="space-y-2 pb-7 border-b border-white/[0.06]">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        {/* Stats */}
        <MetricStripSkeleton cols={4} />
        {/* Table */}
        <TableSkeleton rows={8} cols={5} />
      </div>
    </div>
  );
}
