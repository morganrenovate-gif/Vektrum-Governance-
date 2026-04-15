"use client";

import { useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ReleaseGateResult } from "@/lib/types";
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Shield,
  X,
} from "lucide-react";

interface ReleaseButtonProps {
  milestoneId: string;
  /** Deal ID — reserved for future use / logging */
  dealId?: string;
  amount: number;
  contractorName: string;
  milestoneTitle?: string;
  gate: ReleaseGateResult;
  /** Called when release succeeds so parent can refresh data */
  onSuccess?: () => void;
}

type UIState = "idle" | "confirming" | "loading" | "success" | "error";

export function ReleaseButton({
  milestoneId,
  amount,
  contractorName,
  milestoneTitle,
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
      <div className="flex items-start gap-3 rounded-xl bg-vektrum-green-bg border border-vektrum-green-border px-5 py-4">
        <CheckCircle2 size={20} className="text-vektrum-green mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-vektrum-green">
            Payment released successfully
          </p>
          <p className="mt-0.5 text-sm text-vektrum-green/70">
            <span className="tabular-nums font-bold">{formatMoney(amount)}</span> sent to {contractorName}
          </p>
        </div>
      </div>
    );
  }

  // ── Confirmation modal (overlaid on the section) ───────────────────────────
  if (uiState === "confirming") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-release-title"
        className="relative rounded-xl border-2 border-vektrum-blue bg-vektrum-surface shadow-xl overflow-hidden"
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-vektrum-blue" />

        <div className="px-6 py-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vektrum-blue-subtle">
                <Shield size={18} className="text-vektrum-blue" aria-hidden="true" />
              </div>
              <div>
                <h3
                  id="confirm-release-title"
                  className="font-display text-base font-bold text-vektrum-text"
                >
                  Confirm Payment Release
                </h3>
                <p className="text-xs text-vektrum-muted mt-0.5">
                  This action is irreversible once confirmed
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUiState("idle")}
              className="rounded-md p-1 text-vektrum-faint hover:text-vektrum-muted hover:bg-vektrum-surface-alt transition-colors"
              aria-label="Cancel release"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Amount — the hero element */}
          <div className="rounded-lg bg-vektrum-bg border border-vektrum-border px-5 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
              Amount to be released
            </p>
            <p className="mt-1.5 font-display text-5xl font-bold tabular-nums tracking-tight text-vektrum-text">
              {formatMoney(amount)}
            </p>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <ArrowRight size={12} className="text-vektrum-blue" aria-hidden="true" />
              <p className="text-sm text-vektrum-muted">
                to <span className="font-semibold text-vektrum-text">{contractorName}</span>
              </p>
            </div>
            {milestoneTitle && (
              <p className="mt-1 text-xs text-vektrum-faint">
                Milestone: {milestoneTitle}
              </p>
            )}
          </div>

          {/* What happens */}
          <ul className="space-y-2" aria-label="Release consequences">
            {[
              "Stripe transfer initiates immediately",
              "Milestone marked released — cannot be reversed",
              "Action recorded in immutable audit log",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2 size={14} className="text-vektrum-green mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs text-vektrum-muted">{item}</span>
              </li>
            ))}
          </ul>

          {/* Error feedback */}
          {uiState === "error" && serverError && (
            <div className="flex items-start gap-2 rounded-md bg-vektrum-red-bg border border-vektrum-red-border px-3 py-2.5 text-sm text-vektrum-red">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {serverError}
            </div>
          )}

          {/* Action row */}
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={handleRelease}
              disabled={uiState === "loading"}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-2",
                "min-h-[48px] rounded-lg px-5 py-3",
                "bg-vektrum-blue text-white text-sm font-semibold",
                "shadow-blue transition-all",
                "hover:bg-vektrum-blue-hover",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
              aria-busy={uiState === "loading"}
            >
              {uiState === "loading" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                  Processing…
                </>
              ) : (
                <>
                  <Shield size={15} aria-hidden="true" />
                  Release {formatMoney(amount)}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setUiState("idle"); setServerError(null); }}
              disabled={uiState === "loading"}
              className={cn(
                "inline-flex items-center justify-center",
                "min-h-[48px] rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-3",
                "text-sm font-semibold text-vektrum-muted shadow-xs",
                "transition-all hover:bg-vektrum-surface-alt hover:text-vektrum-text",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Can release — show high-gravity CTA ───────────────────────────────────
  if (canRelease) {
    return (
      <div className="space-y-2">
        {/* Primary CTA with exact amount and elevated visual weight */}
        <button
          type="button"
          onClick={() => setUiState("confirming")}
          className={cn(
            "group inline-flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start",
            "min-h-[52px] rounded-xl px-6 py-3",
            "bg-vektrum-blue text-white font-semibold",
            "shadow-blue transition-all duration-200",
            "hover:bg-vektrum-blue-hover hover:shadow-lg",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
          )}
        >
          <div className="flex items-center gap-2.5">
            <Shield size={16} aria-hidden="true" />
            <span className="text-sm">Release to {contractorName}</span>
          </div>
          <span className="rounded-md bg-white/20 px-2.5 py-1 text-sm font-bold tabular-nums">
            {formatMoney(amount)}
          </span>
        </button>

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
          "inline-flex items-center justify-between gap-3 w-full sm:w-auto",
          "min-h-[52px] rounded-xl px-6 py-3",
          "bg-vektrum-surface-alt text-vektrum-faint cursor-not-allowed",
          "border border-vektrum-border shadow-xs"
        )}
      >
        <div className="flex items-center gap-2.5">
          <Lock size={15} aria-hidden="true" />
          <span className="text-sm font-semibold">Release to {contractorName}</span>
        </div>
        <span className="rounded-md bg-vektrum-border px-2.5 py-1 text-sm font-bold tabular-nums text-vektrum-faint">
          {formatMoney(amount)}
        </span>
      </button>

      {/* Blockers */}
      <div id="release-blockers" className="rounded-xl border border-vektrum-amber-border bg-vektrum-amber-bg overflow-hidden">
        <button
          type="button"
          onClick={() => setBlockersOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-vektrum-amber hover:bg-vektrum-amber-border/20 transition-colors"
          aria-expanded={blockersOpen}
          aria-controls="blockers-list"
        >
          <span className="flex items-center gap-1.5">
            <Lock size={12} aria-hidden="true" />
            {gate.blockers.length} condition{gate.blockers.length !== 1 ? "s" : ""} not met
          </span>
          {blockersOpen ? (
            <ChevronUp size={12} aria-hidden="true" />
          ) : (
            <ChevronDown size={12} aria-hidden="true" />
          )}
        </button>

        <ul
          id="blockers-list"
          className={cn(
            "divide-y divide-vektrum-amber-border/50 border-t border-vektrum-amber-border",
            blockersOpen ? "block" : "hidden sm:block"
          )}
          aria-label="Release blockers"
        >
          {gate.blockers.map((blocker, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 px-4 py-2.5 text-xs text-vektrum-amber"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-vektrum-amber"
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
