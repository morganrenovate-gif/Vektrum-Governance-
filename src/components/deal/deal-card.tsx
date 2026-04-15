import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils";
import { DealStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import type { Deal } from "@/lib/types";
import { ChevronRight, Building2, User } from "lucide-react";

interface DealCardProps {
  deal: Deal;
  className?: string;
}

export function DealCard({ deal, className }: DealCardProps) {
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
      <Card className="transition-shadow duration-150 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-vektrum-blue group-focus-visible:ring-offset-2">
        <CardBody>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="truncate text-sm font-semibold text-vektrum-text group-hover:text-vektrum-blue transition-colors">
                  {deal.title}
                </h3>
                <DealStatusBadge status={deal.status} />
              </div>

              {/* Participants */}
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-vektrum-muted">
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
              className="mt-0.5 flex-shrink-0 text-vektrum-faint group-hover:text-vektrum-blue transition-colors"
              aria-hidden="true"
            />
          </div>

          {/* Money summary row */}
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
                Total
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-vektrum-text">
                {formatMoney(deal.total_amount)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
                Funded
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-vektrum-blue">
                {formatMoney(deal.funded_amount)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
                Released
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-vektrum-green">
                {formatMoney(deal.released_amount)}
              </p>
            </div>
          </div>

          {/* Mini progress bar */}
          <div className="mt-3">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-vektrum-surface-alt">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-vektrum-green"
                style={{ width: `${Math.min(100, releasedPct)}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] text-vektrum-faint">
              {formatMoney(remaining)} remaining
            </p>
          </div>
        </CardBody>

        {deal.milestones && deal.milestones.length > 0 && (
          <CardFooter>
            <p className="text-xs text-vektrum-muted">
              {deal.milestones.length} milestone
              {deal.milestones.length !== 1 ? "s" : ""}
              {" · "}
              {
                deal.milestones.filter((m) => m.status === "released")
                  .length
              }{" "}
              released
            </p>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}
