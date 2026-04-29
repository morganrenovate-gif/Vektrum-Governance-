import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MoneySummary } from "@/components/deal/money-summary";
import { MilestoneCard, type SequentialBlocker } from "@/components/deal/milestone-card";
import { MilestoneDisputeSection } from "@/components/ai/MilestoneDisputeSection";
import { ReleaseButton } from "@/components/deal/release-button";
import { InviteFunderButton } from "@/components/deal/invite-funder-button";
import { DealStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AddMilestoneForm } from "./add-milestone-form";
import { FundDealButton } from "./fund-deal-button";
import { ReleaseRetainageButton } from "./release-retainage-button";
import type { Deal, Profile, Milestone, LienWaiver, ChangeOrder, MilestoneDocument, ReleaseGateResult, ContractStatus } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { ArrowLeft, Info, FolderOpen, FileText, CheckCircle2, Clock, XCircle, AlertCircle, ShieldAlert, ShieldCheck, PenLine } from "lucide-react";
import { SectionHeader, EmptyState } from "@/components/layout";

// ─── Release gate computation (server-side pre-check) ────────────────────────
//
// A lightweight client-side pre-flight that surfaces blockers without a round-
// trip to the release endpoint. The authoritative gate is validateRelease() in
// src/lib/engine/release-gate.ts — this function only needs to be accurate
// enough to give the funder meaningful UI feedback before they click.

function computeReleaseGate(
  milestone: Milestone,
  deal: Deal,
  allMilestones: Milestone[],
): ReleaseGateResult {
  const blockers: string[] = [];

  if (milestone.status !== "approved") {
    blockers.push("Milestone must be approved before payment can be released.");
  }
  if (milestone.protection_status !== "ready_for_release") {
    blockers.push(
      "Milestone protection status is not yet ready for release. The payment may still be processing."
    );
  }
  if (deal.funded_amount < deal.total_amount) {
    blockers.push(
      `Deal is not fully funded. ${formatMoney(
        deal.total_amount - deal.funded_amount
      )} still required.`
    );
  }
  if (deal.status === "disputed") {
    blockers.push("This deal is under dispute. Release is paused.");
  }
  if (deal.status === "cancelled") {
    blockers.push("This deal has been cancelled.");
  }
  if (deal.status === "frozen") {
    blockers.push(
      "This deal is frozen. The contract was voided after milestone payments were released. " +
      "An admin must unfreeze the deal before further releases are permitted."
    );
  }

  // Sequential ordering: every predecessor must be released first
  if (deal.sequential_release_required) {
    const unreleasedPredecessors = allMilestones.filter(
      (m) => m.order_index < milestone.order_index && m.status !== "released"
    );
    for (const pred of unreleasedPredecessors) {
      blockers.push(
        `Sequential order required: "${pred.title}" (position ${pred.order_index + 1}) must be released first.`
      );
    }
  }

  return { can_release: blockers.length === 0, blockers };
}

// ─── Sequential blocker computation ─────────────────────────────────────────
//
// Returns the list of predecessor milestones that are blocking the given
// milestone under sequential enforcement. Empty array = not blocked.

function computeSequentialBlockers(
  milestone: Milestone,
  deal: Deal,
  allMilestones: Milestone[],
): SequentialBlocker[] {
  if (!deal.sequential_release_required) return [];
  if (milestone.status === "released") return [];

  return allMilestones
    .filter(
      (m) => m.order_index < milestone.order_index && m.status !== "released"
    )
    .map((m) => ({
      id:       m.id,
      title:    m.title,
      position: m.order_index + 1,
    }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/auth/login");

  // Deal + relations
  const { data: deal, error } = await supabase
    .from("deals")
    .select(
      `
      *,
      contractor:profiles!deals_contractor_id_fkey(*),
      funder:profiles!deals_funder_id_fkey(*),
      milestones(*)
    `
    )
    .eq("id", dealId)
    .order("order_index", { referencedTable: "milestones", ascending: true })
    .single();

  if (error || !deal) notFound();

  // ── Funder profile fallback ───────────────────────────────────────────────
  // The user-session client (RLS-enforced) may return null for the funder join
  // if the profiles_select policy hasn't been migrated yet (profiles_select_own
  // only allows reading own profile). When funder_id is set but the join is
  // null, fetch the profile via the admin client (server-side only, safe).
  if ((deal as any).funder_id && !(deal as any).funder) {
    const adminClient = createSupabaseAdminClient()
    const { data: fp, error: fpErr } = await adminClient
      .from('profiles')
      .select('id, full_name, company_name, email, role')
      .eq('id', (deal as any).funder_id)
      .single()
    if (fp) {
      ;(deal as any).funder = fp
    } else {
      // Non-fatal: funder_id is set but profile is missing — log for ops visibility.
      console.warn(
        '[deal-detail] funder_id set but profile not found',
        { deal_id: dealId, funder_id: (deal as any).funder_id, err: fpErr?.message },
      )
    }
  }

  // Access control: admin sees all; contractor/funder only their deals
  const typedDeal = deal as Deal;
  const typedProfile = profile as Profile;

  if (
    typedProfile.role === "contractor" &&
    typedDeal.contractor_id !== user.id
  ) {
    notFound();
  }
  if (
    typedProfile.role === "funder" &&
    typedDeal.funder_id !== user.id
  ) {
    notFound();
  }

  const milestones = (typedDeal.milestones ?? []) as Milestone[];

  // Contract — most recent non-voided contract for this deal (at most one,
  // enforced by the contracts_deal_active_unique partial index).
  // Falls back to most recent voided contract so the voided banner is visible.
  const { data: activeContractRaw } = await supabase
    .from("contracts")
    .select("id, status, document_name, docusign_envelope_id, funder_signed_at, contractor_signed_at, voided_at, void_reason, created_at")
    .eq("deal_id", dealId)
    .not("status", "eq", "voided")
    .maybeSingle();

  const { data: voidedContractRaw } = !activeContractRaw
    ? await supabase
        .from("contracts")
        .select("id, status, document_name, voided_at, void_reason, created_at")
        .eq("deal_id", dealId)
        .eq("status", "voided")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const contractRaw = activeContractRaw ?? voidedContractRaw;
  const contract = contractRaw as {
    id: string;
    status: ContractStatus;
    document_name: string;
    docusign_envelope_id?: string | null;
    funder_signed_at?: string | null;
    contractor_signed_at?: string | null;
    voided_at?: string | null;
    void_reason?: string | null;
    created_at: string;
  } | null;

  const milestoneIds = milestones.map((m) => m.id);
  const { data: disputeBriefs } = milestoneIds.length
    ? await supabase
        .from("dispute_briefs")
        .select("*")
        .in("milestone_id", milestoneIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const briefMap = new Map<string, any>();
  for (const brief of disputeBriefs ?? []) {
    if (!briefMap.has(brief.milestone_id)) {
      briefMap.set(brief.milestone_id, brief);
    }
  }

  // Fetch lien waivers for all milestones (most recent per milestone, any status)
  const { data: lienWaiversRaw } = milestoneIds.length
    ? await supabase
        .from("lien_waivers")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Build a map: milestone_id → most recent waiver (any status)
  // The most recent non-superseded waiver is the one the UI cares about.
  const lienWaiverMap = new Map<string, LienWaiver>();
  for (const w of (lienWaiversRaw ?? []) as LienWaiver[]) {
    if (w.milestone_id && !lienWaiverMap.has(w.milestone_id)) {
      lienWaiverMap.set(w.milestone_id, w);
    }
  }

  // Outstanding waivers = any waiver not in 'approved' state (for the summary section)
  const outstandingWaivers = (lienWaiversRaw ?? []).filter(
    (w: any) => w.status !== "approved" && w.milestone_id
  ) as LienWaiver[];

  // Fetch change orders for all milestones on this deal (all statuses, newest first).
  // Build a map: milestone_id → ChangeOrder[] for O(1) lookup per milestone card.
  const { data: changeOrdersRaw } = milestoneIds.length
    ? await supabase
        .from("change_orders")
        .select("id, milestone_id, deal_id, amount, description, status, submitted_by, approved_by, approved_at, created_at, updated_at")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const changeOrdersMap = new Map<string, ChangeOrder[]>();
  for (const co of (changeOrdersRaw ?? []) as ChangeOrder[]) {
    const existing = changeOrdersMap.get(co.milestone_id) ?? [];
    changeOrdersMap.set(co.milestone_id, [...existing, co]);
  }

  // Fetch evidence documents for all milestones on this deal (newest first).
  // Build a map: milestone_id → MilestoneDocument[] for O(1) lookup per card.
  const { data: documentsRaw } = milestoneIds.length
    ? await supabase
        .from("milestone_documents")
        .select("id, milestone_id, uploaded_by, file_url, file_type, description, created_at")
        .in("milestone_id", milestoneIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const documentsMap = new Map<string, MilestoneDocument[]>();
  for (const doc of (documentsRaw ?? []) as MilestoneDocument[]) {
    const existing = documentsMap.get(doc.milestone_id) ?? [];
    documentsMap.set(doc.milestone_id, [...existing, doc]);
  }

  const milestonesTotal = milestones.reduce((s, m) => s + m.amount, 0);
  const remaining = Math.max(0, typedDeal.total_amount - milestonesTotal);
  const isDraftContractor =
    typedDeal.status === "draft" && typedProfile.role === "contractor";
  const funderCanFund =
    typedProfile.role === "funder" &&
    typedDeal.funded_amount < typedDeal.total_amount;

  // Contractor sees invite UI when deal has no funder and is in draft
  const showInviteFunder =
    typedProfile.role === "contractor" &&
    typedDeal.status === "draft" &&
    !typedDeal.funder_id;

  // Funder sees the retainage release button when deal is completed and retainage is held
  const showReleaseRetainage =
    typedProfile.role === "funder" &&
    typedDeal.status === "completed" &&
    (typedDeal.retainage_held ?? 0) > 0;

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="dash-page">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-white/75">
          <li>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-white/65 hover:text-white transition-colors"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true" className="text-white/15">/</li>
          <li className="text-white/85 font-medium truncate max-w-[200px] sm:max-w-xs">
            {typedDeal.title}
          </li>
        </ol>
      </nav>

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[2rem] sm:text-[2.25rem] font-bold tracking-[-0.03em] text-white leading-[1.1]">{typedDeal.title}</h1>
            <DealStatusBadge status={typedDeal.status} />
          </div>
          {typedDeal.description && (
            <p className="max-w-2xl text-sm text-white/80">
              {typedDeal.description}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 text-xs text-white/75">
            {typedDeal.contractor && (
              <span>
                Contractor:{" "}
                <strong className="text-white">
                  {typedDeal.contractor.company_name ??
                    typedDeal.contractor.full_name}
                </strong>
              </span>
            )}
            {typedDeal.funder ? (
              <span>
                Funder:{" "}
                <strong className="text-white">
                  {typedDeal.funder.company_name ?? typedDeal.funder.full_name}
                </strong>
              </span>
            ) : typedDeal.funder_id ? (
              // funder_id is set but the profile join didn't resolve — show
              // a safe fallback rather than "No funder assigned".
              <span className="text-white/60">
                Funder assigned
              </span>
            ) : (
              <span className="text-amber-400 font-medium">
                No funder assigned yet
              </span>
            )}
          </div>
        </div>

        {/* Fund deal (funder only) */}
        {funderCanFund && (
          <FundDealButton
            dealId={typedDeal.id}
            remaining={typedDeal.total_amount - typedDeal.funded_amount}
            stripeConnected={!!typedProfile.stripe_account_id}
          />
        )}
      </div>

      {/* ── Frozen deal banner ── */}
      {typedDeal.status === "frozen" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-5 py-4"
        >
          <ShieldAlert size={18} className="flex-shrink-0 text-red-400 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-[14px] font-semibold text-red-400">Deal frozen — admin action required</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-white/60">
              The contract for this deal was voided after milestone payments had already been
              released. To protect all parties, no further releases or funding can occur
              until an admin reviews and unfreezes this deal.{" "}
              {typedProfile.role !== "admin" && (
                <span>Contact <a href="mailto:operations@vektrum.io" className="text-red-400 hover:underline">operations@vektrum.io</a> with the deal ID to request an unfreeze.</span>
              )}
              {typedProfile.role === "admin" && (
                <span className="text-red-400 font-medium">
                  Unfreeze via <code className="text-[12px] bg-white/[0.07] rounded px-1 py-0.5">
                    POST /api/admin/deals/{typedDeal.id}/unfreeze
                  </code> with admin justification.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ── Contract status indicator ── */}
      {(() => {
        if (!contract) {
          // No contract on file — warn funders who will need one before releases
          return typedProfile.role === "funder" ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-3">
              <AlertCircle size={16} className="flex-shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
              <p className="text-[13px] leading-relaxed text-white/60">
                <span className="font-semibold text-amber-400">No contract on file.</span>{" "}
                A fully-signed contract is required before any milestone can be released.
                The contractor must upload the contract PDF.
              </p>
            </div>
          ) : null;
        }

        if (contract.status === "signed") {
          return (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-3">
              <ShieldCheck size={15} className="flex-shrink-0 text-emerald-400" aria-hidden="true" />
              <p className="text-[13px] text-emerald-400 font-medium">
                Contract fully signed
              </p>
              <span className="text-[12px] text-white/40 ml-1 truncate max-w-[200px] sm:max-w-xs" title={contract.document_name}>
                {contract.document_name}
              </span>
            </div>
          );
        }

        if (contract.status === "voided") {
          return (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-5 py-3">
              <XCircle size={16} className="flex-shrink-0 text-red-400 mt-0.5" aria-hidden="true" />
              <p className="text-[13px] leading-relaxed text-white/60">
                <span className="font-semibold text-red-400">Contract voided.</span>{" "}
                {contract.void_reason && <span>{contract.void_reason}. </span>}
                A new contract must be uploaded and signed before releases can resume.
              </p>
            </div>
          );
        }

        // pending_signatures | funder_signed | contractor_signed
        const funderDone      = !!contract.funder_signed_at;
        const contractorDone  = !!contract.contractor_signed_at;
        return (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-3">
            <PenLine size={16} className="flex-shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-semibold text-amber-400">Awaiting signatures</p>
              <p className="mt-0.5 text-[12px] text-white/55">
                Funder:{" "}
                {funderDone
                  ? <span className="text-emerald-400">✓ signed</span>
                  : <span className="text-amber-400">pending</span>}
                {" · "}
                Contractor:{" "}
                {contractorDone
                  ? <span className="text-emerald-400">✓ signed</span>
                  : <span className="text-amber-400">pending</span>}
                {" · "}
                <span className="truncate" title={contract.document_name}>{contract.document_name}</span>
              </p>
              {typedProfile.role === "funder" && !funderDone && (
                <p className="mt-1 text-[12px] text-amber-400/70">
                  Milestone releases are blocked until the contract is fully executed.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Invite Funder Panel (contractor, draft, no funder) ── */}
      {showInviteFunder && (
        <Card>
          <CardHeader border>
            <CardTitle>Invite a Funder</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-[13px] text-white/80 leading-relaxed">
              Share a secure invite link with your funder. When they accept, they will be
              assigned to this deal and can verify terms, review milestones, and manage
              release authorization. The link is valid for 7 days and is single-use.
            </p>
            <InviteFunderButton dealId={typedDeal.id} />
          </CardBody>
        </Card>
      )}

      {/* ── Money summary ── */}
      <Card>
        <CardBody>
          <MoneySummary
            totalAmount={typedDeal.total_amount}
            fundedAmount={typedDeal.funded_amount}
            releasedAmount={typedDeal.released_amount}
            constructionBudget={typedDeal.construction_budget}
            governanceFeeBps={typedDeal.governance_fee_bps}
            governanceFeeTotal={typedDeal.governance_fee_total}
            facilityTotal={typedDeal.facility_total}
            retainagePercentage={typedDeal.retainage_percentage}
            retainageHeld={typedDeal.retainage_held}
            retainageReleased={typedDeal.retainage_released}
          />
          {/* Release Retainage action — funder, completed deals with held retainage */}
          {showReleaseRetainage && (
            <div className="mt-4 flex justify-end border-t border-white/[0.06] pt-4">
              <ReleaseRetainageButton
                dealId={typedDeal.id}
                retainageHeld={typedDeal.retainage_held!}
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Milestones ── */}
      <section>
        <SectionHeader label="Milestones" count={milestones.length > 0 ? milestones.length : undefined} />

        {milestones.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No milestones yet"
            description={isDraftContractor
              ? "Add the first milestone below to begin structuring this deal."
              : "No milestones have been added to this deal."}
            variant="dashed"
          />
        ) : (
          <div className="space-y-3">
            {milestones.map((milestone) => {
              const gate = computeReleaseGate(milestone, typedDeal, milestones);
              const sequentialBlockers = computeSequentialBlockers(milestone, typedDeal, milestones);
              const latestBrief = briefMap.get(milestone.id) ?? null;
              const contractorName =
                typedDeal.contractor?.full_name ?? "Contractor";

              return (
                <div key={milestone.id} className="space-y-2">
                  <MilestoneCard
                    milestone={milestone}
                    role={typedProfile.role}
                    dealId={typedDeal.id}
                    sequentialBlockers={sequentialBlockers}
                    sequentialDeal={typedDeal.sequential_release_required ?? false}
                    lienWaiver={lienWaiverMap.get(milestone.id) ?? null}
                    lienWaiverRequired={typedDeal.lien_waiver_required ?? false}
                    changeOrders={changeOrdersMap.get(milestone.id) ?? []}
                    documents={documentsMap.get(milestone.id) ?? []}
                  />
                  <MilestoneDisputeSection
                    milestone={{
                    id: milestone.id,
                    title: milestone.title,
                    amount: milestone.amount,
                    status: milestone.status,
        }}
        brief={
          latestBrief
            ? { ...latestBrief, milestone_amount: milestone.amount }
            : null
        }
        role={typedProfile.role}
     />

                  {/* Release button — funder only, approved milestones */}
                  {typedProfile.role === "funder" &&
                    milestone.status !== "released" && (
                      <div className="pl-4">
                        <ReleaseButton
                          milestoneId={milestone.id}
                          dealId={typedDeal.id}
                          amount={milestone.amount}
                          contractorName={contractorName}
                          gate={gate}
                        />
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Lien Waiver Summary (shown when deal has lien_waiver_required) ── */}
      {typedDeal.lien_waiver_required && milestones.length > 0 && (
        <section>
          <SectionHeader
            label="Lien Waivers"
            count={outstandingWaivers.length > 0 ? outstandingWaivers.length : undefined}
          />
          <Card>
            <CardBody>
              {outstandingWaivers.length === 0 ? (
                <div className="flex items-center gap-2.5 py-1">
                  <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
                  <p className="text-[13px] text-emerald-400 font-medium">
                    All lien waivers approved — no outstanding items.
                  </p>
                </div>
              ) : (
                <div className="space-y-0 divide-y divide-white/[0.06]">
                  {milestones.filter(m => m.status !== "released").map((milestone) => {
                    const waiver = lienWaiverMap.get(milestone.id);
                    return (
                      <div key={milestone.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-white/80 truncate">
                            {milestone.title}
                          </p>
                          <p className="text-[11px] text-white/75 tabular-nums">
                            {formatMoney(milestone.amount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!waiver && (
                            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium bg-white/[0.05] text-white/80 border border-white/[0.14]">
                              <FileText size={10} aria-hidden="true" />
                              Not requested
                            </span>
                          )}
                          {waiver?.status === "requested" && (
                            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock size={10} aria-hidden="true" />
                              Awaiting upload
                            </span>
                          )}
                          {waiver?.status === "uploaded" && (
                            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium bg-vektrum-blue/10 text-blue-300 border border-vektrum-blue/30">
                              <FileText size={10} aria-hidden="true" />
                              Awaiting review
                            </span>
                          )}
                          {waiver?.status === "approved" && (
                            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 size={10} aria-hidden="true" />
                              Approved
                            </span>
                          )}
                          {waiver?.status === "rejected" && (
                            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                              <XCircle size={10} aria-hidden="true" />
                              Rejected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </section>
      )}

      {/* ── Add milestone (contractor, draft deals) ── */}
      {isDraftContractor && (
        <section>
          <SectionHeader label="Add Milestone" />
          <Card>
            <CardHeader border>
              <CardTitle>New Milestone</CardTitle>
            </CardHeader>
            <CardBody>
              {/* Running total */}
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-vektrum-blue/25 bg-vektrum-blue/[0.12] px-4 py-3 text-[13px] text-blue-200">
                <Info size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  Milestones allocated:{" "}
                  <strong className="font-semibold">{formatMoney(milestonesTotal)}</strong> of{" "}
                  <strong className="font-semibold">{formatMoney(typedDeal.total_amount)}</strong> —{" "}
                  <strong className="font-semibold">{formatMoney(remaining)}</strong> remaining to allocate.
                </span>
              </div>

              <AddMilestoneForm
                dealId={typedDeal.id}
                maxAmount={remaining}
              />
            </CardBody>
          </Card>
        </section>
      )}
    </div>
    </div>
  );
}
