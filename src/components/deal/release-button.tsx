"use client";

import { useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ReleaseGateResult } from "@/lib/types";
import { Lock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface ReleaseButtonProps {
  milestoneId: string;
  /** Deal ID — reserved for future use / logging */
  dealId?: string;
  amount: number;
  contractorName: string;
  gate: ReleaseGateResult;
  /** Called when release succeeds so parent can refresh data */
  onSuccess?: () => void;
}

type UIState = "idle" | "loading" | "success" | "error";

export function ReleaseButton({
  milestoneId,
  amount,
  contractorName,
  gate,
  onSuccess,
}: ReleaseButtonProps) {
  const [uiState, setUiState] = useState<UIState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [blockersOpen, setBlockersOpen] = useState(false);

  const canRelease = gate.can_release;

  const handleRelease = async () => {
    setUiState("loading");
    setServerError(null);

    try {
      const res = await fetch(
        `/api/milestones/${milestoneId}/release`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok) {
        setUiState("error");
        setServerError(data.error ?? "Release failed. Please contact support.");
      } else {
        setUiState("success");
        onSuccess?.();
      }
    } catch {
      setUiState("error");
      setServerError("Network error. Please try again.");
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (uiState === "success") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-vektrum-green-bg border border-vektrum-green-border px-4 py-3 text-sm font-medium text-vektrum-green">
        <CheckCircle2 size={16} aria-hidden="true" />
        Payment released successfully — {formatMoney(amount)} sent to {contractorName}
      </div>
    );
  }

  // ── Can release ────────────────────────────────────────────────────────────
  if (canRelease) {
    return (
      <div className="space-y-2">
        <Button
          variant="primary"
          size="lg"
          loading={uiState === "loading"}
          onClick={handleRelease}
          className="w-full sm:w-auto"
        >
          Release {formatMoney(amount)} to {contractorName}
        </Button>

        {uiState === "error" && serverError && (
          <div className="flex items-start gap-2 rounded-md bg-vektrum-red-bg border border-vektrum-red-border px-3 py-2 text-sm text-vektrum-red">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {serverError}
          </div>
        )}
      </div>
    );
  }

  // ── Cannot release — show blockers ────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Disabled button */}
      <button
        disabled
        aria-disabled="true"
        aria-describedby="release-blockers"
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium",
          "min-h-[44px] w-full sm:w-auto",
          "bg-vektrum-surface-alt text-vektrum-faint cursor-not-allowed",
          "border border-vektrum-border"
        )}
      >
        <Lock size={14} aria-hidden="true" />
        Release {formatMoney(amount)} to {contractorName}
      </button>

      {/* Blockers — collapsible on mobile */}
      <div id="release-blockers" className="rounded-md border border-vektrum-amber-border bg-vektrum-amber-bg">
        <button
          type="button"
          onClick={() => setBlockersOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-vektrum-amber"
          aria-expanded={blockersOpen}
        >
          <span className="flex items-center gap-1.5">
            <Lock size={12} aria-hidden="true" />
            Release blocked — {gate.blockers.length} requirement
            {gate.blockers.length !== 1 ? "s" : ""} not met
          </span>
          {blockersOpen ? (
            <ChevronUp size={12} aria-hidden="true" />
          ) : (
            <ChevronDown size={12} aria-hidden="true" />
          )}
        </button>

        {/* Always visible on desktop, collapsible on mobile */}
        <ul
          className={cn(
            "divide-y divide-vektrum-amber-bg border-t border-vektrum-amber-border",
            blockersOpen ? "block" : "hidden sm:block"
          )}
          aria-label="Release blockers"
        >
          {gate.blockers.map((blocker, i) => (
            <li
              key={i}
              className="flex items-start gap-2 px-3 py-2 text-xs text-vektrum-amber"
            >
              <span
                className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-vektrum-amber"
                aria-hidden="true"
              />
              {blocker}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
