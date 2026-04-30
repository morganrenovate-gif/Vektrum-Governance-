"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentRow {
  milestoneTitle: string | null;
  dealTitle: string | null;
  amount: number;
  releasedAt: string;
}

interface ExportButtonProps {
  payments: PaymentRow[];
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ExportButton({ payments }: ExportButtonProps) {
  const handleExport = () => {
    const header = ["Milestone", "Deal", "Amount (USD)", "Date Released"];
    const rows = payments.map((p) => [
      escapeCSV(p.milestoneTitle ?? "—"),
      escapeCSV(p.dealTitle ?? "—"),
      (p.amount / 100).toFixed(2),
      new Date(p.releasedAt).toISOString().split("T")[0],
    ]);

    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `vektrum-payments-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleExport} disabled={payments.length === 0}>
      <Download size={13} aria-hidden="true" />
      Export CSV
    </Button>
  );
}
