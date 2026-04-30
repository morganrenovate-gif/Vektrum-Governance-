import {
  PageHeaderSkeleton,
  MetricStripSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

/**
 * Loading skeleton for /dashboard/contractor/payments.
 *
 * Mirrors the actual payments page:
 *   1. PageHeader (Payments eyebrow + title + description)
 *   2. 3-stat MetricStrip (Total Disbursed, Pending, This Month)
 *   3. Payments table
 */
export default function PaymentsLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page space-y-8">

        {/* 1. Page header */}
        <PageHeaderSkeleton hasAction hasDescription />

        {/* 2. Stats strip */}
        <MetricStripSkeleton cols={3} />

        {/* 3. Payments table */}
        <TableSkeleton rows={6} cols={5} />

      </div>
    </div>
  );
}
