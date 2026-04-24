"use client";

import { useEffect, useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import { MilestoneStatusBadge, ProtectionStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Milestone, UserRole } from "@/lib/types";
import { CheckCircle2, AlertCircle, ChevronDown, ListOrdered, Lock } from "lucide-react";
import { DrawReviewAgent } from "@/components/ai/draw-review-agent";

/** A predecessor milestone that is blocking sequential release. */
export interface SequentialBlocker {
  id:         string;
  title:      string;
  /** 1-based display position derived from order_index */
  position:   number;
}

// Left-border color coding by milestone status — dark-context tokens only.
// Actionable milestones are visually differentiated from passive ones.
const statusBorderColor: Record<Milestone['status'], string> = {
  not_started:       "border-l-white/[0.08]",
  in_progress:       "border-l-vektrum-blue",
  ready_for_review:  "border-l-amber-500",
  approved:          "border-l-emerald-500",
  released:          "border-l-emerald-500",
  disputed:          "border-l-red-500",
  payout_failed:     "border-l-red-500",
};

// Shadow elevation for actionable states
const statusShadow: Record<Milestone['status'], string> = {
  not_started:       "shadow-xs",
  in_progress:       "shadow-sm",
  ready_for_review:  "shadow-md",
  approved:          "shadow-sm",
  released:          "shadow-xs",
  disputed:          "shadow-md",
  payout_failed:     "shadow-md",
};

interface MilestoneCardProps {
  milestone: Milestone;
  role: UserRole;
  dealId: string;
  onStatusChange?: (milestoneId: string, newStatus: Milestone["status"]) => void;
  /**
   * Milestones that must be released before this one can proceed.
   * Populated by the deal page when deal.sequential_release_required = true
   * or when explicit milestone_prerequisites exist.
   * Empty array (or undefined) means no sequential block.
   */
  sequentialBlockers?: SequentialBlocker[];
  /** True when this deal enforces sequential release order. */
  sequentialDeal?: boolean;
}

export function MilestoneCard({
  milestone,
  role,
  dealId,
  onStatusChange,
  sequentialBlockers = [],
  sequentialDeal = false,
}: MilestoneCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [aiAssessment, setAiAssessment] = useState<{
    assessment_id?: string
    risk_level?: string
    score?: number
    findings?: string[]
    recommendation?: string
    reasoning?: string
    reviewed_at?: string
  } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const handleAction = async (action: string) => {
    console.log('handleAction fired', action)
    setLoading(action);
    setError(null);
    setSuccess(null);

    const statusMap: Record<string, string> = {
      start: "in_progress",
      submit: "ready_for_review",
      approve: "approved",
      request_changes: "in_progress",
    };
    const new_status = statusMap[action];
    if (!new_status) {
      setError("Unknown action.");
      setLoading(null);
      return;
    }

    try {
      const res = await fetch(`/api/milestones/${milestone.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_status }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Action failed. Please try again.");
      } else {
        setSuccess("Updated successfully.");
        onStatusChange?.(milestone.id, data.milestone?.status ?? milestone.status);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const isReleased          = milestone.status === "released";
  const isSequentiallyBlocked = sequentialBlockers.length > 0;
  const position            = milestone.order_index + 1;  // 1-based display number
  const borderColor = isSequentiallyBlocked
    ? "border-l-amber-500/60"
    : (statusBorderColor[milestone.status] ?? "border-l-white/[0.08]");
  const shadowClass = statusShadow[milestone.status] ?? "shadow-xs";
  const isReadyForReview = milestone.status === 'ready_for_review'
  const showAiPanel =
    milestone.status === 'ready_for_review' || milestone.status === 'approved'

  if (isReleased) {
    return (
      <details className={cn("rounded-lg border border-white/[0.08] bg-surface-2 overflow-hidden border-l-[3px]", borderColor, shadowClass)}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 hover:bg-surface-3 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold text-white truncate">{milestone.title}</span>
            <MilestoneStatusBadge status={milestone.status} />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
            <span className="text-sm font-bold tabular-nums text-white">{formatMoney(milestone.amount)}</span>
            <ChevronDown size={14} className="text-white/30" aria-hidden="true" />
          </div>
        </summary>
        <div className="border-t border-white/[0.06] px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
                <h4 className="text-sm font-semibold text-white">{milestone.title}</h4>
              </div>
              {milestone.description && (
                <p className="text-sm text-white/55">{milestone.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <MilestoneStatusBadge status={milestone.status} />
                <ProtectionStatusBadge status={milestone.protection_status} />
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Amount</p>
                <p className="text-xl font-bold tabular-nums text-white">{formatMoney(milestone.amount)}</p>
              </div>
            </div>
          </div>
          {error && (
            <div className="mt-3 flex items-start gap-1.5 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2 text-sm text-red-400">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}
          {success && (
            <div className="mt-3 flex items-start gap-1.5 rounded-md bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-2 text-sm text-emerald-400">
              <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {success}
            </div>
          )}
        </div>
      </details>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.08] bg-surface-2 overflow-hidden",
        "border-l-[3px]",
        borderColor,
        shadowClass,
        "transition-shadow duration-150",
      )}
    >
      <div className="px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: info */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Position badge — shown on sequential deals */}
              {sequentialDeal && (
                <span
                  title={`Milestone ${position} of ${sequentialDeal ? 'sequential deal' : 'deal'}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    isSequentiallyBlocked
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-white/[0.06] text-white/40 border border-white/[0.08]",
                  )}
                >
                  <ListOrdered size={10} aria-hidden="true" />
                  #{position}
                </span>
              )}
              <h4 className="text-sm font-semibold text-white">
                {milestone.title}
              </h4>
              {isSequentiallyBlocked && (
                <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Lock size={9} aria-hidden="true" />
                  Awaiting predecessor
                </span>
              )}
            </div>

            {milestone.description && (
              <p className="text-sm text-white/55">{milestone.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <MilestoneStatusBadge status={milestone.status} />
              <ProtectionStatusBadge status={milestone.protection_status} />
            </div>
          </div>

          {/* Right: amount + actions */}
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                Amount
              </p>
              <p className="text-xl font-bold tabular-nums text-white">
                {formatMoney(milestone.amount)}
              </p>
            </div>

            {/* Action buttons — role + status matrix */}
            <div className="flex flex-wrap gap-2">
              {/* Contractor actions */}
              {role === "contractor" && milestone.status === "not_started" && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={loading === "start"}
                  onClick={() => handleAction("start")}
                >
                  Start Work
                </Button>
              )}
              {role === "contractor" && milestone.status === "in_progress" && (
                <Button
                  size="sm"
                  variant="primary"
                  loading={loading === "submit"}
                  onClick={() => handleAction("submit")}
                >
                  Submit for Review
                </Button>
              )}

              {/* Funder actions */}
              {role === "funder" && milestone.status === "ready_for_review" && (
                <>
                  <Button
                    size="sm"
                    variant="success"
                    loading={loading === "approve"}
                    onClick={() => handleAction("approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={loading === "request_changes"}
                    onClick={() => handleAction("request_changes")}
                  >
                    Request Changes
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* AI Draw Review Agent — shown for ready_for_review and approved milestones */}
        {(milestone.status === 'ready_for_review' || milestone.status === 'approved') && (
          <div className="mt-4">
            <DrawReviewAgent milestoneId={milestone.id} milestoneStatus={milestone.status} />
          </div>
        )}

        {/* Sequential release blocker notice */}
        {isSequentiallyBlocked && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Lock size={14} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-amber-400 mb-1.5">
                  Release blocked — sequential order required
                </p>
                <p className="text-[11px] text-amber-400/70 mb-2">
                  The following milestone{sequentialBlockers.length !== 1 ? 's' : ''} must be
                  released before this one can proceed:
                </p>
                <ul className="space-y-1">
                  {sequentialBlockers.map((blocker) => (
                    <li
                      key={blocker.id}
                      className="flex items-center gap-1.5 text-[11px] text-amber-300/80"
                    >
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/15 text-amber-400 text-[9px] font-bold tabular-nums flex-shrink-0">
                        {blocker.position}
                      </span>
                      <span className="truncate">{blocker.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Error / success feedback */}
        {error && (
          <div className="mt-3 flex items-start gap-1.5 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2 text-sm text-red-400">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 flex items-start gap-1.5 rounded-md bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-2 text-sm text-emerald-400">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
