"use client";

import { useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import { MilestoneStatusBadge, ProtectionStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Milestone, UserRole } from "@/lib/types";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { DrawReviewAgent } from "@/components/ai/draw-review-agent";

// Left-border color coding by milestone status — Tier 2 spec
// Actionable milestones are visually differentiated from passive ones.
const statusBorderColor: Record<Milestone['status'], string> = {
  not_started:       "border-l-vektrum-border",
  in_progress:       "border-l-vektrum-blue",
  ready_for_review:  "border-l-vektrum-amber",
  approved:          "border-l-vektrum-green",
  released:          "border-l-vektrum-green",
  disputed:          "border-l-vektrum-red",
};

// Shadow elevation for actionable states
const statusShadow: Record<Milestone['status'], string> = {
  not_started:       "shadow-xs",
  in_progress:       "shadow-sm",
  ready_for_review:  "shadow-md",
  approved:          "shadow-sm",
  released:          "shadow-xs",
  disputed:          "shadow-md",
};

interface MilestoneCardProps {
  milestone: Milestone;
  role: UserRole;
  dealId: string;
  onStatusChange?: (milestoneId: string, newStatus: Milestone["status"]) => void;
}

export function MilestoneCard({
  milestone,
  role,
  dealId,
  onStatusChange,
}: MilestoneCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setLoading(action);
    setError(null);
    setSuccess(null);

    const statusMap: Record<string, string> = {
      start: "in_progress",
      submit: "ready_for_review",
      approve: "approved",
      request_changes: "changes_requested",
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

  const isReleased = milestone.status === "released";
  const borderColor = statusBorderColor[milestone.status] ?? "border-l-vektrum-border";
  const shadowClass = statusShadow[milestone.status] ?? "shadow-xs";

  return (
    <div
      className={cn(
        "rounded-lg border border-vektrum-border bg-vektrum-surface overflow-hidden",
        "border-l-[3px]",
        borderColor,
        shadowClass,
        "transition-shadow duration-150",
        isReleased && "opacity-75"
      )}
    >
      <div className="px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: info */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {isReleased && (
                <CheckCircle2
                  size={15}
                  className="text-vektrum-green flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              <h4 className="text-sm font-semibold text-vektrum-text">
                {milestone.title}
              </h4>
            </div>

            {milestone.description && (
              <p className="text-sm text-vektrum-muted">{milestone.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <MilestoneStatusBadge status={milestone.status} />
              <ProtectionStatusBadge status={milestone.protection_status} />
            </div>
          </div>

          {/* Right: amount + actions */}
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
                Amount
              </p>
              <p className="text-xl font-bold tabular-nums text-vektrum-text">
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

        {/* Error / success feedback */}
        {error && (
          <div className="mt-3 flex items-start gap-1.5 rounded-md bg-vektrum-red-bg border border-vektrum-red-border px-3 py-2 text-sm text-vektrum-red">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 flex items-start gap-1.5 rounded-md bg-vektrum-green-bg border border-vektrum-green-border px-3 py-2 text-sm text-vektrum-green">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
