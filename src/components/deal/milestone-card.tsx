"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatMoney } from "@/lib/utils";
import { MilestoneStatusBadge, ProtectionStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Milestone, UserRole, LienWaiver, ChangeOrder, MilestoneDocument } from "@/lib/types";
import {
  CheckCircle2, AlertCircle, ChevronDown, ListOrdered, Lock,
  FileText, Upload, Clock, XCircle, Copy, Check, Plus, GitPullRequest,
  Paperclip, Download,
} from "lucide-react";
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
  /**
   * Most recent lien waiver for this milestone (any status).
   * Null/undefined = no waiver has been requested yet.
   */
  lienWaiver?: LienWaiver | null;
  /** True when deal.lien_waiver_required = true. */
  lienWaiverRequired?: boolean;
  /**
   * All change orders for this milestone (all statuses), newest-first.
   * Provided by the deal page via changeOrdersMap.get(milestone.id) ?? [].
   */
  changeOrders?: ChangeOrder[];
  /**
   * Evidence / supporting documents uploaded for this milestone, newest-first.
   * Provided by the deal page via documentsMap.get(milestone.id) ?? [].
   */
  documents?: MilestoneDocument[];
}

export function MilestoneCard({
  milestone,
  role,
  dealId,
  onStatusChange,
  sequentialBlockers = [],
  sequentialDeal = false,
  lienWaiver,
  lienWaiverRequired = false,
  changeOrders = [],
  documents = [],
}: MilestoneCardProps) {
  const router = useRouter();
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

  // ── Lien waiver state ───────────────────────────────────────────────────
  const [lienWaiverState, setLienWaiverState] = useState<LienWaiver | null>(lienWaiver ?? null)
  const [lienLoading, setLienLoading] = useState<string | null>(null)
  const [lienError, setLienError]   = useState<string | null>(null)
  const [copied, setCopied]         = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showRejectInput, setShowRejectInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleRequestWaiver = async () => {
    setLienLoading("request")
    setLienError(null)
    try {
      const res = await fetch(
        `/api/deals/${dealId}/milestones/${milestone.id}/lien-waiver`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            waiver_type:   "conditional_progress",
            waiver_amount: milestone.amount,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setLienError(data.error ?? "Failed to request lien waiver.")
      } else {
        setLienWaiverState(data.lien_waiver)
        router.refresh()
      }
    } catch {
      setLienError("Network error. Please try again.")
    } finally {
      setLienLoading(null)
    }
  }

  const handleUpload = async (file: File) => {
    if (!lienWaiverState) return
    setLienLoading("upload")
    setLienError(null)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const res = await fetch(`/api/lien-waivers/${lienWaiverState.id}/upload`, {
        method: "POST",
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        setLienError(data.error ?? "Failed to upload waiver.")
      } else {
        setLienWaiverState(data.lien_waiver)
        router.refresh()
      }
    } catch {
      setLienError("Network error. Please try again.")
    } finally {
      setLienLoading(null)
    }
  }

  const handleApproveWaiver = async () => {
    if (!lienWaiverState) return
    setLienLoading("approve")
    setLienError(null)
    try {
      const res = await fetch(`/api/lien-waivers/${lienWaiverState.id}/approve`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        setLienError(data.error ?? "Failed to approve waiver.")
      } else {
        setLienWaiverState(data.lien_waiver)
        router.refresh()
      }
    } catch {
      setLienError("Network error. Please try again.")
    } finally {
      setLienLoading(null)
    }
  }

  const handleRejectWaiver = async () => {
    if (!lienWaiverState || rejectReason.trim().length < 10) return
    setLienLoading("reject")
    setLienError(null)
    try {
      const res = await fetch(`/api/lien-waivers/${lienWaiverState.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLienError(data.error ?? "Failed to reject waiver.")
      } else {
        setLienWaiverState(data.lien_waiver)
        setShowRejectInput(false)
        setRejectReason("")
        router.refresh()
      }
    } catch {
      setLienError("Network error. Please try again.")
    } finally {
      setLienLoading(null)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable
    }
  }

  // ── Change order state ──────────────────────────────────────────────────────
  const [localOrders, setLocalOrders] = useState<ChangeOrder[]>(changeOrders)
  const [showCOForm, setShowCOForm]       = useState(false)
  const [coAmount, setCoAmount]           = useState("")
  const [coDescription, setCoDescription] = useState("")
  const [coSubmitLoading, setCoSubmitLoading] = useState(false)
  const [coDecideLoading, setCoDecideLoading] = useState<string | null>(null)
  const [coError, setCoError]             = useState<string | null>(null)

  // The actionable submitted CO for this milestone (there can be at most one).
  const submittedCO = localOrders.find((co) => co.status === "submitted") ?? null

  // ── Evidence / Document state ───────────────────────────────────────────────
  const [localDocs, setLocalDocs] = useState<MilestoneDocument[]>(documents)
  const [docUploadLoading, setDocUploadLoading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const docFileInputRef = useRef<HTMLInputElement>(null)

  const canUploadDocs =
    role === "contractor" &&
    (milestone.status === "in_progress" || milestone.status === "ready_for_review")

  const handleDocUpload = async (file: File) => {
    setDocUploadLoading(true)
    setDocError(null)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const res = await fetch(`/api/milestones/${milestone.id}/documents/upload`, {
        method: "POST",
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        setDocError(data.error ?? "Failed to upload evidence file.")
      } else {
        setLocalDocs([data.document, ...localDocs])
        router.refresh()
      }
    } catch {
      setDocError("Network error. Please try again.")
    } finally {
      setDocUploadLoading(false)
    }
  }

  const handleCreateCO = async () => {
    const amountNum = parseFloat(coAmount)
    if (!coAmount || isNaN(amountNum) || amountNum === 0) {
      setCoError("Amount must be a non-zero number (use negative for decreases).")
      return
    }
    if (coDescription.trim().length < 10) {
      setCoError("Description must be at least 10 characters.")
      return
    }
    setCoSubmitLoading(true)
    setCoError(null)
    try {
      const res = await fetch("/api/change-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestone_id: milestone.id,
          amount:       amountNum,
          description:  coDescription.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCoError(data.error ?? "Failed to submit change order.")
      } else {
        setLocalOrders([data.change_order, ...localOrders])
        setShowCOForm(false)
        setCoAmount("")
        setCoDescription("")
        router.refresh()
      }
    } catch {
      setCoError("Network error. Please try again.")
    } finally {
      setCoSubmitLoading(false)
    }
  }

  const handleDecideCO = async (changeOrderId: string, decision: "approved" | "rejected") => {
    setCoDecideLoading(changeOrderId)
    setCoError(null)
    try {
      const res = await fetch(`/api/change-orders/${changeOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCoError(data.error ?? `Failed to ${decision} change order.`)
      } else {
        // Update local state: replace the CO with the updated version
        setLocalOrders(localOrders.map((co) =>
          co.id === changeOrderId ? data.change_order : co
        ))
        router.refresh()
      }
    } catch {
      setCoError("Network error. Please try again.")
    } finally {
      setCoDecideLoading(null)
    }
  }

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
            <ChevronDown size={14} className="text-white/65" aria-hidden="true" />
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">Amount</p>
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
                      : "bg-white/[0.06] text-white/75 border border-white/[0.14]",
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">
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

        {/* ── Lien Waiver Panel ── */}
        {lienWaiverRequired && (
          <div className="mt-3">
            {/* Hidden file input for contractor upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
                e.target.value = ""  // reset so same file can be re-selected
              }}
            />

            {/* ── No waiver requested yet ── */}
            {!lienWaiverState && (
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={13} className="text-white/75 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-[12px] font-semibold text-white/70">Lien Waiver Required</p>
                    <p className="text-[11px] text-white/75">
                      {role === "funder"
                        ? "Request a conditional progress waiver from the contractor."
                        : "The funder must request a lien waiver before this milestone can be released."}
                    </p>
                  </div>
                </div>
                {role === "funder" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={lienLoading === "request"}
                    onClick={handleRequestWaiver}
                    className="flex-shrink-0"
                  >
                    Request Waiver
                  </Button>
                )}
              </div>
            )}

            {/* ── Requested — awaiting contractor upload ── */}
            {lienWaiverState?.status === "requested" && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Clock size={13} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-amber-400">
                        {role === "contractor"
                          ? "Lien Waiver Requested — Upload Required"
                          : "Awaiting Contractor Upload"}
                      </p>
                      <p className="text-[11px] text-amber-400/60 mt-0.5">
                        {role === "contractor"
                          ? "Please upload your signed conditional progress lien waiver (PDF)."
                          : "The contractor must upload the signed waiver before you can approve it."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {role === "contractor" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={lienLoading === "upload"}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={12} className="mr-1" aria-hidden="true" />
                        Upload Waiver
                      </Button>
                    )}
                    {role === "funder" && (
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        title="Copy page link to share with contractor"
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-amber-400/80 border border-amber-500/20 hover:bg-amber-500/10 transition-colors"
                      >
                        {copied
                          ? <><Check size={11} aria-hidden="true" /> Copied!</>
                          : <><Copy size={11} aria-hidden="true" /> Copy Link</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Uploaded — awaiting funder review ── */}
            {lienWaiverState?.status === "uploaded" && (
              <div className="rounded-lg border border-vektrum-blue/20 bg-vektrum-blue/[0.04] px-4 py-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <FileText size={13} className="text-blue-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white/80">
                        {role === "funder" ? "Waiver Uploaded — Review Required" : "Waiver Uploaded"}
                      </p>
                      <p className="text-[11px] text-white/75 mt-0.5">
                        {role === "funder"
                          ? "Review the signed waiver PDF and approve or reject it."
                          : "Your waiver is under review by the funder."}
                      </p>
                    </div>
                  </div>
                  {role === "funder" && !showRejectInput && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="success"
                        size="sm"
                        loading={lienLoading === "approve"}
                        onClick={handleApproveWaiver}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setShowRejectInput(true)}
                        disabled={lienLoading !== null}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {/* Reject inline form */}
                {role === "funder" && showRejectInput && (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      placeholder="Explain why the waiver is rejected (e.g. incorrect through-date, missing notarization)…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-2 text-[12px] text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/60 resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        loading={lienLoading === "reject"}
                        disabled={rejectReason.trim().length < 10}
                        onClick={handleRejectWaiver}
                      >
                        Confirm Rejection
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowRejectInput(false); setRejectReason("") }}
                        disabled={lienLoading !== null}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Approved ── */}
            {lienWaiverState?.status === "approved" && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-2.5 flex items-center gap-2.5">
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-[12px] font-semibold text-emerald-400">
                    Lien Waiver Approved
                  </p>
                  {lienWaiverState.approved_at && (
                    <p className="text-[11px] text-emerald-400/60">
                      Approved{" "}
                      {new Date(lienWaiverState.approved_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Rejected — contractor re-upload ── */}
            {lienWaiverState?.status === "rejected" && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-red-400">Waiver Rejected</p>
                      {lienWaiverState.rejection_reason && (
                        <p className="text-[11px] text-red-400/70 mt-0.5 break-words">
                          {lienWaiverState.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  {role === "contractor" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={lienLoading === "upload"}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-shrink-0"
                    >
                      <Upload size={12} className="mr-1" aria-hidden="true" />
                      Re-upload
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Lien waiver error feedback */}
            {lienError && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2 text-[12px] text-red-400">
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                {lienError}
              </div>
            )}
          </div>
        )}

        {/* ── Change Order Panel ────────────────────────────────────────────── */}
        {/* Visible to:
              • Contractor (any non-released milestone) — to submit a CO request.
              • Funder (when a submitted CO awaits decision).
              • Both roles (when COs exist in history).
            Does NOT: touch DB directly, bypass the release gate, or allow self-approval. */}
        {(localOrders.length > 0 || (role === "contractor" && milestone.status !== "released")) && (
          <div className="mt-3 space-y-2">

            {/* ── Section label ── */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55">
                <GitPullRequest size={11} aria-hidden="true" />
                Change Orders
              </div>
              {/* Contractor: "Request" button only when no submitted CO and milestone not released */}
              {role === "contractor" && !submittedCO && milestone.status !== "released" && !showCOForm && (
                <button
                  type="button"
                  onClick={() => { setShowCOForm(true); setCoError(null) }}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-white/65 border border-white/[0.12] hover:bg-white/[0.06] hover:text-white/90 transition-colors"
                >
                  <Plus size={11} aria-hidden="true" />
                  Request
                </button>
              )}
            </div>

            {/* ── Submitted CO — awaiting decision ── */}
            {submittedCO && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Clock size={13} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-amber-400">
                        {role === "funder" ? "Change Order Pending — Decision Required" : "Change Order Submitted"}
                      </p>
                      <p className="text-[11px] text-amber-400/70 mt-0.5 break-words">
                        {submittedCO.description}
                      </p>
                      <p className="text-[11px] text-amber-400/50 mt-1 tabular-nums">
                        {submittedCO.amount > 0 ? "+" : ""}{formatMoney(submittedCO.amount)} delta
                        {" · "}
                        {new Date(submittedCO.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  {/* Funder approve / reject */}
                  {role === "funder" && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="success"
                        size="sm"
                        loading={coDecideLoading === submittedCO.id}
                        disabled={coDecideLoading !== null}
                        onClick={() => handleDecideCO(submittedCO.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={coDecideLoading === submittedCO.id}
                        disabled={coDecideLoading !== null}
                        onClick={() => handleDecideCO(submittedCO.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Contractor: inline create form ── */}
            {role === "contractor" && showCOForm && (
              <div className="rounded-lg border border-white/[0.12] bg-white/[0.03] px-4 py-3 space-y-3">
                <p className="text-[12px] font-semibold text-white/80">Request Change Order</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-white/65 mb-1">
                      Amount delta ($)
                      <span className="ml-1 text-white/40 font-normal">Positive = increase, negative = decrease</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 2500 or -500"
                      value={coAmount}
                      onChange={(e) => setCoAmount(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-2 text-[12px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-vektrum-blue/50 focus:border-vektrum-blue/60 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-white/65 mb-1">
                      Description
                      <span className="ml-1 text-white/40 font-normal">Min 10 characters</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Explain why this change is needed…"
                      value={coDescription}
                      onChange={(e) => setCoDescription(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-2 text-[12px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-vektrum-blue/50 focus:border-vektrum-blue/60 resize-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={coSubmitLoading}
                    disabled={coSubmitLoading}
                    onClick={handleCreateCO}
                  >
                    Submit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={coSubmitLoading}
                    onClick={() => { setShowCOForm(false); setCoAmount(""); setCoDescription(""); setCoError(null) }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* ── CO history (approved / rejected / paid) ── */}
            {localOrders.filter((co) => co.status !== "submitted").length > 0 && (
              <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                {localOrders
                  .filter((co) => co.status !== "submitted")
                  .map((co) => (
                    <div key={co.id} className="flex items-start gap-2.5 px-4 py-2.5">
                      {co.status === "approved" && <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />}
                      {co.status === "rejected" && <XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />}
                      {co.status === "paid"     && <CheckCircle2 size={13} className="text-blue-400 flex-shrink-0 mt-0.5" aria-hidden="true" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "text-[11px] font-semibold uppercase tracking-wide",
                            co.status === "approved" ? "text-emerald-400"
                            : co.status === "rejected" ? "text-red-400"
                            : "text-blue-400"
                          )}>
                            {co.status.charAt(0).toUpperCase() + co.status.slice(1)}
                          </span>
                          <span className="text-[11px] text-white/50 tabular-nums">
                            {co.amount > 0 ? "+" : ""}{formatMoney(co.amount)}
                          </span>
                          <span className="text-[11px] text-white/35">
                            {new Date(co.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/55 mt-0.5 break-words">{co.description}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* CO error feedback */}
            {coError && (
              <div className="flex items-start gap-1.5 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2 text-[12px] text-red-400">
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                {coError}
              </div>
            )}
          </div>
        )}

        {/* ── Evidence / Supporting Documents panel ──────────────────────── */}
        {(localDocs.length > 0 || canUploadDocs) && (
          <div className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-2">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Paperclip size={13} className="text-white/45 flex-shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white/55">
                  Supporting Documents
                </span>
                {localDocs.length > 0 && (
                  <span className="ml-0.5 inline-flex items-center rounded-full bg-white/[0.07] px-1.5 py-px text-[10px] font-semibold text-white/55">
                    {localDocs.length}
                  </span>
                )}
              </div>
              {/* Upload button — contractor only, eligible status only */}
              {canUploadDocs && (
                <>
                  <button
                    type="button"
                    onClick={() => docFileInputRef.current?.click()}
                    disabled={docUploadLoading}
                    className="inline-flex items-center gap-1 rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-white/70 hover:bg-white/[0.07] hover:text-white/90 transition-colors disabled:pointer-events-none disabled:opacity-50"
                    aria-label="Attach evidence file"
                  >
                    {docUploadLoading ? (
                      <>
                        <Clock size={11} className="animate-spin" aria-hidden="true" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload size={11} aria-hidden="true" />
                        Attach Evidence
                      </>
                    )}
                  </button>
                  {/* Hidden file input — PDF, PNG, JPEG up to 20 MB */}
                  <input
                    ref={docFileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleDocUpload(file)
                        e.target.value = ""
                      }
                    }}
                    aria-hidden="true"
                  />
                </>
              )}
            </div>

            {/* Document list */}
            {localDocs.length === 0 ? (
              <p className="text-[11px] text-white/35 italic pl-0.5">
                No evidence uploaded for this milestone yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {localDocs.map((doc) => {
                  // Human-friendly type label from file_type (DB enum values)
                  const typeLabel =
                    doc.file_type === "photo"
                      ? "Photo"
                      : doc.file_type === "change_order"
                      ? "Change Order"
                      : "Document"

                  // Display name: description stores the original filename at upload time.
                  // Fall back to the last path segment of the URL if description is blank.
                  const displayName =
                    doc.description?.trim() ||
                    doc.file_url.split("/").pop()?.split("?")[0] ||
                    "File"

                  return (
                    <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] border border-white/[0.05] px-2.5 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <FileText size={11} className="flex-shrink-0 text-white/40" aria-hidden="true" />
                          <span className="truncate text-[12px] font-medium text-white/80">{displayName}</span>
                          <span className="flex-shrink-0 rounded bg-white/[0.06] px-1 py-px text-[10px] text-white/40 font-mono">
                            {typeLabel}
                          </span>
                        </div>
                        <div className="mt-0.5 pl-[19px]">
                          <span className="text-[10px] text-white/30">
                            {new Date(doc.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 inline-flex items-center gap-1 rounded border border-white/[0.10] px-2 py-1 text-[11px] font-medium text-white/55 hover:text-white/80 hover:border-white/20 transition-colors"
                        aria-label={`Download ${doc.description || 'document'}`}
                      >
                        <Download size={11} aria-hidden="true" />
                        Open
                      </a>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Upload hint — safe wording, no authenticity claims */}
            {canUploadDocs && (
              <p className="text-[10px] text-white/25 pl-0.5">
                PDF, PNG, or JPEG · max 20 MB · uploaded files are visible to your funder
              </p>
            )}

            {/* Upload error */}
            {docError && (
              <div className="flex items-start gap-1.5 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2 text-[12px] text-red-400">
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                {docError}
              </div>
            )}
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
