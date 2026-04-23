"use client";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import React from "react";

// ─── ActionBar ─────────────────────────────────────────────────────────────────
//
// A structured footer zone for high-consequence actions — fund release,
// deal creation, dispute resolution. Separates the action from the content
// above it and adds visual weight appropriate to financial operations.
//
// Usage:
//   <ActionBar
//     consequence="Releasing $680,000.00 to Marcus Webb"
//     warning="This action is permanent and cannot be reversed."
//     primaryAction={<Button variant="primary">Release Funds</Button>}
//     secondaryAction={<Button variant="ghost">Cancel</Button>}
//   />
//
interface ActionBarProps {
  consequence?: React.ReactNode;
  warning?: string;
  primaryAction: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function ActionBar({
  consequence,
  warning,
  primaryAction,
  secondaryAction,
  className,
}: ActionBarProps) {
  return (
    <div
      className={cn(
        "rounded-b-2xl border-t border-white/[0.08] bg-surface-3/60 px-5 py-4",
        className
      )}
    >
      {(consequence || warning) && (
        <div className="mb-3">
          {consequence && (
            <p className="text-[13px] font-medium text-white/70">{consequence}</p>
          )}
          {warning && (
            <div className="mt-1.5 flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-amber-400/70" />
              <p className="text-[12px] text-amber-400/70">{warning}</p>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        {secondaryAction}
        {primaryAction}
      </div>
    </div>
  );
}

// ─── InlineActionRow ──────────────────────────────────────────────────────────
//
// Lighter action row — used when actions are paired without the consequence
// description, e.g. form submit + cancel.
//
interface InlineActionRowProps {
  children: React.ReactNode;
  className?: string;
  borderTop?: boolean;
}

export function InlineActionRow({
  children,
  className,
  borderTop = true,
}: InlineActionRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 pt-4",
        borderTop && "border-t border-white/[0.08] mt-4",
        className
      )}
    >
      {children}
    </div>
  );
}
