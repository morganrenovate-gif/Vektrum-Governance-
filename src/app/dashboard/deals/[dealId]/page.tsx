import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MoneySummary } from "@/components/deal/money-summary";
import { MilestoneCard } from "@/components/deal/milestone-card";
import { MilestoneDisputeSection } from "@/components/ai/MilestoneDisputeSection";
import { ReleaseButton } from "@/components/deal/release-button";
import { InviteFunderButton } from "@/components/deal/invite-funder-button";
import { DealStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AddMilestoneForm } from "./add-milestone-form";
import { FundDealButton } from "./fund-deal-button";
import type { Deal, Profile, Milestone, ReleaseGateResult } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { ArrowLeft, Info, FolderOpen } from "lucide-react";
import { SectionHeader, EmptyState } from "@/components/layout";

// ─── Release gate computation (server-side) ───────────────────────────────────

function computeReleaseGate(
  milestone: Milestone,
  deal: Deal
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

  return { can_release: blockers.length === 0, blockers };
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

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="dash-page">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-white/50">
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
          <li className="text-white/50 font-medium truncate max-w-[200px] sm:max-w-xs">
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
            <p className="max-w-2xl text-sm text-white/55">
              {typedDeal.description}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 text-xs text-white/35">
            {typedDeal.contractor && (
              <span>
                Contractor:{" "}
                <strong className="text-white/55">
                  {typedDeal.contractor.company_name ??
                    typedDeal.contractor.full_name}
                </strong>
              </span>
            )}
            {typedDeal.funder ? (
              <span>
                Funder:{" "}
                <strong className="text-white/55">
                  {typedDeal.funder.full_name}
                </strong>
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

      {/* ── Invite Funder Panel (contractor, draft, no funder) ── */}
      {showInviteFunder && (
        <Card>
          <CardHeader border>
            <CardTitle>Invite a Funder</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-[13px] text-white/50 leading-relaxed">
              Share a secure invite link with your funder. When they accept, they will be
              assigned to this deal room and can begin reviewing milestones and funding the
              project. The link is valid for 7 days and is single-use.
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
          />
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
              const gate = computeReleaseGate(milestone, typedDeal);
              const latestBrief = briefMap.get(milestone.id) ?? null;
              const contractorName =
                typedDeal.contractor?.full_name ?? "Contractor";

              return (
                <div key={milestone.id} className="space-y-2">
                  <MilestoneCard
                    milestone={milestone}
                    role={typedProfile.role}
                    dealId={typedDeal.id}
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
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-vektrum-blue/20 bg-vektrum-blue/[0.07] px-4 py-3 text-[13px] text-vektrum-blue">
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
