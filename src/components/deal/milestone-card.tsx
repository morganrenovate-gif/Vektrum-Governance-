"use client";

import { useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import { MilestoneStatusBadge, ProtectionStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import type { Milestone, UserRole } from "@/lib/types";
import { CheckCircle2, AlertCircle } from "lucide-react";

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

    try {
      const res = await fetch(`/api/milestones/${milestone.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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

  return (
    <Card
      className={cn(
        "transition-shadow",
        isReleased && "opacity-80"
      )}
    >
      <CardBody>
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
              <p className="text-lg font-bold tabular-nums text-vektrum-text">
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

        {/* Error / success feedback */}
        {error && (
          <div className="mt-3 flex items-start gap-1.5 rounded-md bg-vektrum-red-bg px-3 py-2 text-sm text-vektrum-red">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 flex items-start gap-1.5 rounded-md bg-vektrum-green-bg px-3 py-2 text-sm text-vektrum-green">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {success}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
