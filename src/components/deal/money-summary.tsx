import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/utils";
import { rateLabel } from "@/lib/engine/billing";

interface MoneySummaryProps {
  totalAmount: number;
  fundedAmount: number;
  releasedAmount: number;
  // ── Governance fee model (null / undefined on legacy deals) ──────────────
  constructionBudget?: number | null;
  governanceFeeBps?: number | null;
  governanceFeeTotal?: number | null;
  facilityTotal?: number | null;
  // ── Retainage (null / undefined when retainage_percentage = 0) ───────────
  retainagePercentage?: number | null;
  retainageHeld?: number | null;
  retainageReleased?: number | null;
  className?: string;
}

export function MoneySummary({
  totalAmount,
  fundedAmount,
  releasedAmount,
  constructionBudget,
  governanceFeeBps,
  governanceFeeTotal,
  facilityTotal,
  retainagePercentage,
  retainageHeld,
  retainageReleased,
  className,
}: MoneySummaryProps) {
  const remaining = Math.max(0, totalAmount - releasedAmount);
  const fundedPct = totalAmount > 0 ? (fundedAmount / totalAmount) * 100 : 0;
  const releasedPct = totalAmount > 0 ? (releasedAmount / totalAmount) * 100 : 0;

  // Governance breakdown is shown only when all four fields are present and positive
  const hasGovernance =
    constructionBudget != null &&
    constructionBudget > 0 &&
    governanceFeeBps != null &&
    governanceFeeTotal != null &&
    facilityTotal != null;

  // Retainage section shown only when a retainage rate is configured
  const hasRetainage =
    retainagePercentage != null &&
    retainagePercentage > 0;
  const heldBalance     = retainageHeld    ?? 0;
  const releasedBalance = retainageReleased ?? 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Three-column money display */}
      <div className="grid grid-cols-3 gap-4">
        <Money label="Funded" amount={fundedAmount} size="lg" />
        <Money label="Released" amount={releasedAmount} size="lg" />
        <Money label="Remaining" amount={remaining} size="lg" muted={remaining === 0} />
      </div>

      {/* Progress bar — h-4 per Tier 2 spec, featured size */}
      <div className="space-y-2">
        <div
          className="relative h-4 w-full overflow-hidden rounded-full bg-white/[0.07] shadow-inner"
          role="progressbar"
          aria-label="Payment progress"
          aria-valuenow={releasedPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* Funded bar (blue background) */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-vektrum-blue opacity-20 transition-all duration-500"
            style={{ width: `${Math.min(100, fundedPct)}%` }}
          />
          {/* Released bar (green foreground) */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-vektrum-green transition-all duration-500"
            style={{ width: `${Math.min(100, releasedPct)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/75">
          <span className="tabular-nums">
            {releasedPct.toFixed(0)}% released
          </span>
          <span className="tabular-nums">
            {fundedPct.toFixed(0)}% funded
          </span>
        </div>
      </div>

      {/* ── Governance Fee Breakdown ──────────────────────────────────────────
          Rendered only for deals created under the governance model (migration 004+).
          Shows the funder the full facility structure:
            Construction Budget   (project value / contractor disbursements)
          + Governance Layer      (Vektrum oversight fee)
          = Total Facility Size
      */}
      {hasGovernance && (
        <div className="mt-1 rounded-lg border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.06]">
          {/* Header */}
          <div className="px-4 py-2.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">
              Facility Structure
            </span>
          </div>

          {/* Construction Budget row */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-white/80">Construction Budget</p>
              <p className="text-[11px] text-white/75 mt-0.5">
                Total contract value — disbursed to contractor
              </p>
            </div>
            <span className="text-[14px] font-semibold tabular-nums text-white">
              {formatMoney(constructionBudget!)}
            </span>
          </div>

          {/* Governance Layer row */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-white/80">
                Governance Layer
                <span className="ml-2 text-[11px] font-normal text-white/75">
                  {rateLabel(governanceFeeBps!)}
                </span>
              </p>
              <p className="text-[11px] text-white/75 mt-0.5">
                Vektrum oversight & compliance fee
              </p>
            </div>
            <span className="text-[14px] font-semibold tabular-nums text-vektrum-amber">
              +{formatMoney(governanceFeeTotal!)}
            </span>
          </div>

          {/* Total Facility row */}
          <div className="px-4 py-3 flex items-center justify-between bg-white/[0.02] rounded-b-lg">
            <div>
              <p className="text-[13px] font-semibold text-white">Total Facility Size</p>
              <p className="text-[11px] text-white/75 mt-0.5">
                Full funder commitment including governance
              </p>
            </div>
            <span className="text-[15px] font-bold tabular-nums text-vektrum-blue">
              {formatMoney(facilityTotal!)}
            </span>
          </div>
        </div>
      )}

      {/* ── Retainage Breakdown ───────────────────────────────────────────────────
          Rendered only when a retainage rate > 0 is configured on the deal.
          Shows the funder the current state of withheld and released retainage.
      */}
      {hasRetainage && (
        <div className="mt-1 rounded-lg border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.06]">
          {/* Header */}
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">
              Retainage
            </span>
            <span className="text-[11px] font-semibold text-amber-400/80 tabular-nums">
              {retainagePercentage!.toFixed(retainagePercentage! % 1 === 0 ? 0 : 2)}% withheld per milestone
            </span>
          </div>

          {/* Currently Held row */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-white/80">Currently Held</p>
              <p className="text-[11px] text-white/75 mt-0.5">
                Withheld from milestone releases — pending project completion
              </p>
            </div>
            <span className={cn(
              "text-[14px] font-semibold tabular-nums",
              heldBalance > 0 ? "text-amber-400" : "text-white/75"
            )}>
              {formatMoney(heldBalance)}
            </span>
          </div>

          {/* Released row — only shown once any retainage has been released */}
          {releasedBalance > 0 && (
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-white/80">Released to Contractor</p>
                <p className="text-[11px] text-white/75 mt-0.5">
                  Cumulative retainage disbursed
                </p>
              </div>
              <span className="text-[14px] font-semibold tabular-nums text-vektrum-green">
                {formatMoney(releasedBalance)}
              </span>
            </div>
          )}

          {/* Total retainage balance row */}
          <div className="px-4 py-3 flex items-center justify-between bg-white/[0.02] rounded-b-lg">
            <div>
              <p className="text-[13px] font-semibold text-white">Total Retainage Pool</p>
              <p className="text-[11px] text-white/75 mt-0.5">
                Held + released (cumulative withheld)
              </p>
            </div>
            <span className="text-[14px] font-bold tabular-nums text-white/70">
              {formatMoney(heldBalance + releasedBalance)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
