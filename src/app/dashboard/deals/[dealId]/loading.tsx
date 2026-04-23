import { MilestoneCardSkeleton, MoneySummarySkeleton, MetricStripSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function DealLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page space-y-8">
        {/* Breadcrumb */}
        <Skeleton className="h-4 w-36" />

        {/* Title block */}
        <div className="space-y-2 pb-7 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-1/2" />
        </div>

        {/* Money summary */}
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-5">
          <MoneySummarySkeleton />
        </div>

        {/* Milestones */}
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          {[0, 1, 2].map((i) => (
            <MilestoneCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
