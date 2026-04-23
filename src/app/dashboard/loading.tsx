import { DashboardSkeleton } from "@/components/ui/skeleton";

/**
 * Next.js streaming loading UI for the /dashboard route.
 *
 * Shown immediately while the async server component fetches auth + profile + deals.
 * The outer shell (bg-surface-0 / min-h-screen) MUST be here — the root layout
 * body sets bg-vektrum-bg (light) so without this wrapper skeleton cards would
 * float on a light surface.
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <DashboardSkeleton />
    </div>
  );
}
