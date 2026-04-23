import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils";
import { DealStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import type { Deal, MilestoneStatus } from "@/lib/types";
import { ChevronRight, Building2, User } from "lucide-react";

interface DealCardProps {
  deal: Deal;
  className?: string;
  /** When set, shows role-specific action button based on milestone state */
  viewerRole?: 'contractor' | 'funder' | 'admin';
}

function getContractorAction(deal: Deal): { label: string; href: string; variant: 'default' | 'status' | 'danger' } | null {
  const milestones = deal.milestones ?? []

  if (milestones.length === 0) {
    return { label: 'Continue Setup', href: `/dashboard/deals/${deal.id}/milestones`, variant: 'default' }
  }

  // Check for disputed first (highest priority alert)
  if (milestones.some((m) => m.status === 'disputed')) {
    return { label: 'View Dispute', href: `/dashboard/deals/${deal.id}`, variant: 'danger' }
  }

  // All released
  if (milestones.every((m) => m.status === 'released')) {
    return { label: 'Project Complete', href: `/dashboard/deals/${deal.id}`, variant: 'status' }
  }

  // Priority order for active milestones
  const statusPriority: MilestoneStatus[] = ['ready_for_review', 'in_progress', 'not_started', 'approved']
  for (const status of statusPriority) {
    const ms = milestones.find((m) => m.status === status)
    if (!ms) continue
    switch (status) {
      case 'ready_for_review':
        return { label: 'Submit for Review', href: `/dashboard/deals/${deal.id}#milestone-${ms.id}`, variant: 'default' }
      case 'in_progress':
        return { label: 'Upload Documents', href: `/dashboard/deals/${deal.id}#milestone-${ms.id}`, variant: 'default' }
      case 'not_started':
        return { label: 'Start Milestone', href: `/dashboard/deals/${deal.id}`, variant: 'default' }
      case 'approved':
        return { label: 'Awaiting Release', href: '', variant: 'status' }
    }
  }

  return null
}

export function DealCard({ deal, className, viewerRole }: DealCardProps) {
  const remaining = Math.max(0, deal.total_amount - deal.released_amount);
  const releasedPct =
    deal.total_amount > 0
      ? (deal.released_amount / deal.total_amount) * 100
      : 0;

  return (
    <Link
      href={`/dashboard/deals/${deal.id}`}
      className={cn("block group focus:outline-none", className)}
    >
      <Card className="transition-all duration-200 group-hover:shadow-card-hover group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-vektrum-blue group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface-0">
        <CardBody>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="truncate text-sm font-semibold text-white group-hover:text-vektrum-blue transition-colors">
                  {deal.title}
                </h3>
                <DealStatusBadge status={deal.status} />
              </div>

              {/* Participants */}
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
                {deal.contractor && (
                  <span className="flex items-center gap-1">
                    <Building2 size={11} aria-hidden="true" />
                    {deal.contractor.company_name ?? deal.contractor.full_name}
                  </span>
                )}
                {deal.funder && (
                  <span className="flex items-center gap-1">
                    <User size={11} aria-hidden="true" />
                    {deal.funder.full_name}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight
              size={16}
              className="mt-0.5 flex-shrink-0 text-white/25 group-hover:text-vektrum-blue transition-colors"
              aria-hidden="true"
            />
          </div>

          {/* Money summary row */}
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                Total
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white/80">
                {formatMoney(deal.total_amount)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                Funded
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-vektrum-blue">
                {formatMoney(deal.funded_amount)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                Released
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-400">
                {formatMoney(deal.released_amount)}
              </p>
            </div>
          </div>

          {/* Mini progress bar */}
          <div className="mt-3">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-emerald-500/70"
                style={{ width: `${Math.min(100, releasedPct)}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] text-white/25">
              {formatMoney(remaining)} remaining
            </p>
          </div>
        </CardBody>

        <CardFooter>
          <div className="flex items-center justify-between w-full gap-2">
            <p className="text-xs text-white/35">
              {deal.milestones && deal.milestones.length > 0 ? (
                <>
                  {deal.milestones.length} milestone
                  {deal.milestones.length !== 1 ? "s" : ""}
                  {" · "}
                  {deal.milestones.filter((m) => m.status === "released").length}{" "}
                  released
                </>
              ) : (
                'No milestones'
              )}
            </p>
            {viewerRole === 'contractor' && (() => {
              const action = getContractorAction(deal)
              if (!action) return null
              if (action.variant === 'status') {
                return (
                  <span className={cn(
                    "text-[11px] font-medium px-2.5 py-1 rounded-full border",
                    action.label === 'Project Complete'
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  )}>
                    {action.label}
                  </span>
                )
              }
              return (
                <span className={cn(
                  "text-[11px] font-medium px-2.5 py-1 rounded-full border",
                  action.variant === 'danger'
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-vektrum-blue/10 text-vektrum-blue border-vektrum-blue/20"
                )}>
                  {action.label} →
                </span>
              )
            })()}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
