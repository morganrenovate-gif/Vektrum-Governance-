import { MilestoneCardSkeleton, MoneySummarySkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading state for the deal detail page.
 * Shown while deal data, milestones, and release gate status are fetched.
 */
export default function DealLoading() {
  return (
    <div className="page-container section space-y-6">
      {/* Breadcrumb skeleton */}
      <Skeleton className="h-4 w-40" />

      {/* Deal title */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Money summary */}
      <div className="rounded-lg border border-vektrum-border bg-vektrum-surface p-5 shadow-sm">
        <MoneySummarySkeleton />
      </div>

      {/* Milestones */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-28 mb-2" />
        {[0, 1, 2].map((i) => (
          <MilestoneCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
