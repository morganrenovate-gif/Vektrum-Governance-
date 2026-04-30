import { PageHeaderSkeleton, DocumentListSkeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for /dashboard/contractor/documents.
 *
 * Mirrors the ContractorDocumentsPage structure:
 *   1. PageHeader (Documents eyebrow + Deal Documents title + description)
 *   2. Document list table (file icon + name + deal + type + date + download)
 */
export default function DocumentsLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page space-y-8">

        {/* 1. Page header */}
        <PageHeaderSkeleton hasDescription />

        {/* 2. Document list */}
        <DocumentListSkeleton rows={7} />

      </div>
    </div>
  );
}
