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
import { ArrowLeft, Info } from "lucide-react";

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
    <div className="page-container py-8 space-y-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-vektrum-faint">
          <li>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 hover:text-vektrum-text transition-colors"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true" className="text-vektrum-border">/</li>
          <li className="text-vektrum-muted font-medium truncate max-w-[200px] sm:max-w-xs">
            {typedDeal.title}
          </li>
        </ol>
      </nav>

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-vektrum-text">{typedDeal.title}</h1>
            <DealStatusBadge status={typedDeal.status} />
          </div>
          {typedDeal.description && (
            <p className="max-w-2xl text-sm text-vektrum-muted">
              {typedDeal.description}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 text-xs text-vektrum-faint">
            {typedDeal.contractor && (
              <span>
                Contractor:{" "}
                <strong className="text-vektrum-muted">
                  {typedDeal.contractor.company_name ??
                    typedDeal.contractor.full_name}
                </strong>
              </span>
            )}
            {typedDeal.funder ? (
              <span>
                Funder:{" "}
                <strong className="text-vektrum-muted">
                  {typedDeal.funder.full_name}
                </strong>
              </span>
            ) : (
              <span className="text-vektrum-amber font-medium">
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
            <p className="mb-4 text-sm text-vektrum-muted">
              Share a secure invite link with your funder. When they accept, they will be
              assigned to this deal room and can begin reviewing milestones and funding the
              project. The link is valid for 7 days.
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
          />
        </CardBody>
      </Card>

      {/* ── Milestones ── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-vektrum-muted">
            Milestones ({milestones.length})
          </h2>
        </div>

        {milestones.length === 0 ? (
          <div className="rounded-lg border border-dashed border-vektrum-border bg-vektrum-surface-alt px-8 py-12 text-center">
            <p className="text-sm text-vektrum-faint">
              {isDraftContractor
                ? "No milestones yet. Add the first one below."
                : "No milestones have been added to this deal."}
            </p>
          </div>
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
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">
            Add Milestone
          </h2>
          <Card>
            <CardHeader border>
              <CardTitle>New Milestone</CardTitle>
            </CardHeader>
            <CardBody>
              {/* Running total */}
              <div className="mb-5 flex items-start gap-2 rounded-md bg-vektrum-blue-subtle border border-vektrum-blue-border px-3 py-2.5 text-sm text-vektrum-blue">
                <Info size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  Milestones allocated:{" "}
                  <strong>{formatMoney(milestonesTotal)}</strong> of{" "}
                  <strong>{formatMoney(typedDeal.total_amount)}</strong> —{" "}
                  <strong>{formatMoney(remaining)}</strong> remaining to
                  allocate.
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
  );
}
