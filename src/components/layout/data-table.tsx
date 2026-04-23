import { cn } from "@/lib/utils";
import React from "react";

// ─── DataTable ─────────────────────────────────────────────────────────────────
//
// Canonical table container for the Vektrum dashboard.
// Replaces the ad-hoc table implementations in audit/page.tsx,
// contractor/payments/page.tsx, admin/page.tsx, etc.
//
// Usage:
//   <DataTable>
//     <DataTableHead>
//       <DataTableRow>
//         <DataTableTh>Date</DataTableTh>
//         <DataTableTh align="right">Amount</DataTableTh>
//       </DataTableRow>
//     </DataTableHead>
//     <DataTableBody>
//       <DataTableRow>
//         <DataTableTd>Jan 1</DataTableTd>
//         <DataTableTd align="right" numeric>$50,000</DataTableTd>
//       </DataTableRow>
//     </DataTableBody>
//   </DataTable>
//

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="data-table w-full border-collapse">{children}</table>
    </div>
  );
}

export function DataTableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <thead className={cn("border-b border-white/[0.06]", className)}>
      {children}
    </thead>
  );
}

export function DataTableBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tbody className={className}>{children}</tbody>;
}

export function DataTableFoot({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tfoot className={cn("border-t border-white/[0.08]", className)}>
      {children}
    </tfoot>
  );
}

export function DataTableRow({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(onClick && "cursor-pointer", className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function DataTableTh({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        align === "right" && "col-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </th>
  );
}

export function DataTableTd({
  children,
  className,
  align = "left",
  numeric = false,
  muted = false,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** Use JetBrains Mono for financial figures */
  numeric?: boolean;
  /** Softer text — for secondary metadata columns */
  muted?: boolean;
}) {
  return (
    <td
      className={cn(
        align === "right" && "col-right",
        align === "center" && "text-center",
        numeric && "font-mono font-numeric tabular-nums !text-white",
        muted && "!text-white/40",
        className
      )}
    >
      {children}
    </td>
  );
}

// ─── TableContainer ───────────────────────────────────────────────────────────
//
// Wraps the DataTable with the standard card shell + optional filter bar area.
// This is the outermost container used in full-page table views.
//
interface TableContainerProps {
  children: React.ReactNode;
  /** Optional slot for filter bar / action row above the table */
  filterBar?: React.ReactNode;
  className?: string;
}

export function TableContainer({
  children,
  filterBar,
  className,
}: TableContainerProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-surface-2 overflow-hidden shadow-card",
        className
      )}
    >
      {filterBar && (
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          {filterBar}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── TablePagination ─────────────────────────────────────────────────────────
interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPrev,
  onNext,
}: TablePaginationProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = end < total;

  return (
    <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
      <p className="text-[12px] text-white/35 font-numeric tabular-nums">
        {total === 0 ? "No results" : `${start}–${end} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={onPrev}
          className="min-h-[32px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-medium text-white/55 hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!hasNext}
          onClick={onNext}
          className="min-h-[32px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-medium text-white/55 hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
