import { ReceiptDetailSkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for /dashboard/receipts/[receiptId].
 *
 * Mirrors the ReceiptPage layout:
 *   1. Breadcrumb navigation (Dashboard / Deal title / Receipt)
 *   2. Page header: icon + title + subtitle
 *   3. ReceiptCard (via ReceiptDetailSkeleton): status + amount hero + key-value rows + actions
 *   4. Compliance note
 *   5. Back to deal link
 *
 * NOTE: This page uses bg-[#0A0A0A] (slightly darker than surface-0) and
 * max-w-2xl mx-auto — mirrored here for a seamless transition.
 */
export default function ReceiptLoading() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-8">
      <div className="mx-auto max-w-2xl">

        {/* 1. Breadcrumb */}
        <div className="mb-6 flex items-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-2.5 w-2" />
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-2.5 w-2" />
          <Skeleton className="h-3 w-14" />
        </div>

        {/* 2. Page header: icon + title + subtitle */}
        <div className="mb-6 flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>

        {/* 3. Receipt card */}
        <ReceiptDetailSkeleton />

        {/* 4. Compliance note */}
        <Skeleton className="mt-4 h-2.5 w-72 mx-auto" />

        {/* 5. Back link */}
        <div className="mt-6 flex justify-center items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5" />
          <Skeleton className="h-3 w-24" />
        </div>

      </div>
    </div>
  );
}
