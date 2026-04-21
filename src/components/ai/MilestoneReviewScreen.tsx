'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ContractAnalysisResult, DealMetadata, ProposedMilestone } from "./ContractUploadModal";

type Props = {
  metadata: DealMetadata;
  analysis: ContractAnalysisResult;
  onBack: () => void;
  onClose: () => void;
};

type SaveState = "idle" | "saving" | "error";

export function MilestoneReviewScreen({ metadata, analysis, onBack, onClose }: Props) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const runningTotal = analysis.milestones.reduce((sum, m) => sum + m.amount, 0);

  async function handleCreateDeal() {
    setSaveState("saving");
    setError(null);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not authenticated");
      setSaveState("error");
      return;
    }

    try {
      // Create the deal
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .insert({
          title: metadata.deal_name,
          total_amount: runningTotal,
          status: "draft",
          contractor_id: session.user.id,
        })
        .select("id")
        .single();

      if (dealError || !deal) throw new Error(dealError?.message ?? "Failed to create deal");

      // Insert milestones in order
      const milestoneRows = analysis.milestones.map((m: ProposedMilestone) => ({
        deal_id: deal.id,
        title: m.name,
        description: m.notes || null,
        amount: m.amount,
        order_index: m.sequence_order - 1,
      }));

      const { error: msError } = await supabase.from("milestones").insert(milestoneRows);
      if (msError) throw new Error(msError.message);

      router.push(`/dashboard/deals/${deal.id}`);
      onClose();
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Failed to create deal");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-vektrum-border bg-vektrum-surface shadow-2xl shadow-black/40 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-vektrum-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-vektrum-faint hover:text-vektrum-text transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-blue mb-0.5">
                AI Contract Import
              </p>
              <h2 className="text-[16px] font-semibold text-vektrum-text tracking-[-0.01em]">
                Review extracted milestones
              </h2>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-vektrum-faint">Total value</p>
            <p className="text-[15px] font-semibold text-vektrum-text">
              ${runningTotal.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-3">

          {/* Missing clauses warning */}
          {analysis.missing_clauses.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-4">
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-amber-400 mb-1">Missing or unclear clauses</p>
                {analysis.missing_clauses.map((c) => (
                  <p key={c} className="text-[12px] text-amber-400/80">· {c}</p>
                ))}
              </div>
            </div>
          )}

          {/* Milestones */}
          {analysis.milestones.map((m, i) => (
            <div
              key={i}
              className="rounded-xl border border-vektrum-border bg-vektrum-bg overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-vektrum-blue/10 text-[11px] font-bold text-vektrum-blue">
                    {m.sequence_order}
                  </span>
                  <span className="text-[13px] font-semibold text-vektrum-text">{m.name}</span>
                  {m.flags.length > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                      {m.flags.length} flag{m.flags.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-semibold text-vektrum-text">
                    ${m.amount.toLocaleString()}
                  </span>
                  {expandedIdx === i ? (
                    <ChevronUp size={14} className="text-vektrum-faint" />
                  ) : (
                    <ChevronDown size={14} className="text-vektrum-faint" />
                  )}
                </div>
              </button>

              {expandedIdx === i && (
                <div className="border-t border-vektrum-border px-4 py-3 space-y-2.5">
                  {m.conditions.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint mb-1">
                        Conditions
                      </p>
                      {m.conditions.map((c, ci) => (
                        <p key={ci} className="text-[12px] text-vektrum-muted">· {c}</p>
                      ))}
                    </div>
                  )}
                  {m.notes && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint mb-1">
                        Notes
                      </p>
                      <p className="text-[12px] text-vektrum-muted">{m.notes}</p>
                    </div>
                  )}
                  {m.flags.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-400/70 mb-1">
                        Flags
                      </p>
                      {m.flags.map((f, fi) => (
                        <p key={fi} className="text-[12px] text-amber-400/80">· {f}</p>
                      ))}
                    </div>
                  )}
                  {m.retainage_pct > 0 && (
                    <p className="text-[12px] text-vektrum-muted">
                      Retainage: {m.retainage_pct}%
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Retainage summary */}
          {analysis.retainage_summary && (
            <div className="rounded-xl border border-vektrum-border/50 bg-vektrum-bg px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint mb-1">
                Retainage summary
              </p>
              <p className="text-[12px] text-vektrum-muted">{analysis.retainage_summary}</p>
            </div>
          )}

          {error && (
            <p className="text-[13px] text-red-400 text-center">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-vektrum-border flex-shrink-0">
          <button
            onClick={handleCreateDeal}
            disabled={saveState === "saving"}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-5 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/25 hover:bg-vektrum-blue-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saveState === "saving" ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Creating deal...
              </>
            ) : (
              <>
                <CheckCircle size={14} />
                Create deal with {analysis.milestones.length} milestones
              </>
            )}
          </button>
          <button
            onClick={onBack}
            disabled={saveState === "saving"}
            className="rounded-xl border border-vektrum-border px-4 py-3 text-[14px] font-semibold text-vektrum-muted hover:bg-vektrum-surface-alt transition-all disabled:opacity-40"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
