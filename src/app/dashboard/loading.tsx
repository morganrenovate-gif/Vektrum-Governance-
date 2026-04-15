import { DashboardSkeleton } from "@/components/ui/skeleton";

/**
 * Next.js streaming loading UI for the dashboard route.
 * Shown immediately while the async server component fetches data.
 * Prevents the "Is my money still there?" feeling during load.
 */
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
