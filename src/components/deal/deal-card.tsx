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
  viewerRole?: 'contractor' | 'funder' | 'admin';
}

function getContractorAction(deal: Deal): { label: string; href: string; variant: 'default' | 'status' | 'danger' } | null {
  const milestones = deal.milestones ?? []

  if (milestones.length === 0) {
    return { label: 'Continue Setup', href: `/dashboard/deals/${deal.id}/milestones`, variant: 'default' }
  }

  if (milestones.some((m) => m.status === 'disputed')) {
    return { label: 'View Dispute', href: `/dashboard/deals/${deal.id}`, variant: 'danger' }
  }

  if (milestones.every((m) => m.status === 'released')) {
    return { label: 'Project Complete', href: `/dashboard/deals/${deal.id}`, variant: 'status' }
  }

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

  const milestones = deal.milestones ?? [];
  const releasedCount = milestones.filter((m) => m.status === "released").length;

  return (
    <Link
      href={`/dashboard/deals/${deal.id}`}
      className={cn("block group focus:outline-none", className)}
    >
      <Card className="transition-all duration-200 group-hover:shadow-card-hover group-hover:-translate-y-[2px] group-hover:border-white/[0.14] group-focus-visible:ring-2 group-focus-visible:ring-vektrum-blue group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface-0">
        <CardBody className="pb-3">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-white group-hover:text-blue-300 transition-colors leading-tight truncate">
                {deal.title}
              </h3>

              {/* Participants */}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-white/75">
                {deal.contractor && (
                  <span className="flex items-center gap-1">
                    <Building2 size={10} aria-hidden="true" />
                    {deal.contractor.company_name ?? deal.contractor.full_name}
                  </span>
                )}
                {deal.funder && (
                  <span className="flex items-center gap-1">
                    <User size={10} aria-hidden="true" />
                    {deal.funder.full_name}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1.5 mt-0.5">
              <DealStatusBadge status={deal.status} />
              <ChevronRight
                size={14}
                className="text-white/60 group-hover:text-blue-300 transition-colors"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Financial data row — 3 columns, tight */}
          <div className="mt-4 grid grid-cols-3 gap-0 divide-x divide-white/[0.06] -mx-1">
            <div className="px-1 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/65 mb-1">
                Total
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-white/65 font-mono tracking-tight">
                {formatMoney(deal.total_amount)}
              </p>
            </div>
            <div className="px-1 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/65 mb-1">
                Funded
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-blue-300 font-mono tracking-tight">
                {formatMoney(deal.funded_amount)}
              </p>
            </div>
            <div className="px-1 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/65 mb-1">
                Released
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-emerald-400 font-mono tracking-tight">
                {formatMoney(deal.released_amount)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-emerald-500/60 transition-all duration-500"
                style={{ width: `${Math.min(100, releasedPct)}%` }}
              />
              {deal.funded_amount > 0 && deal.total_amount > 0 && (
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-vektrum-blue/30"
                  style={{ width: `${Math.min(100, (deal.funded_amount / deal.total_amount) * 100)}%` }}
                />
              )}
            </div>
          </div>
        </CardBody>

        <CardFooter>
          <div className="flex items-center justify-between w-full gap-2">
            <p className="text-[11px] text-white/70 tabular-nums">
              {milestones.length > 0 ? (
                <>{milestones.length} milestone{milestones.length !== 1 ? "s" : ""} · {releasedCount} released</>
              ) : (
                "No milestones"
              )}
            </p>

            {viewerRole === 'contractor' && (() => {
              const action = getContractorAction(deal)
              if (!action) return null
              if (action.variant === 'status') {
                return (
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border tracking-wide uppercase",
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
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border tracking-wide uppercase",
                  action.variant === 'danger'
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-vektrum-blue/20 text-blue-300 border-vektrum-blue/40"
                )}>
                  {action.label}
                </span>
              )
            })()}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
