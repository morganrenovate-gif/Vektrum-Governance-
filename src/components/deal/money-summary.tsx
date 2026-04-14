import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";

interface MoneySummaryProps {
  totalAmount: number;
  fundedAmount: number;
  releasedAmount: number;
  className?: string;
}

export function MoneySummary({
  totalAmount,
  fundedAmount,
  releasedAmount,
  className,
}: MoneySummaryProps) {
  const remaining = Math.max(0, totalAmount - releasedAmount);
  const fundedPct = totalAmount > 0 ? (fundedAmount / totalAmount) * 100 : 0;
  const releasedPct = totalAmount > 0 ? (releasedAmount / totalAmount) * 100 : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Three-column money display */}
      <div className="grid grid-cols-3 gap-4">
        <Money label="Funded" amount={fundedAmount} size="lg" />
        <Money label="Released" amount={releasedAmount} size="lg" />
        <Money label="Remaining" amount={remaining} size="lg" muted={remaining === 0} />
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div
          className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Payment progress"
          aria-valuenow={releasedPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* Funded bar (blue background) */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-vektrum-blue opacity-30 transition-all duration-500"
            style={{ width: `${Math.min(100, fundedPct)}%` }}
          />
          {/* Released bar (green foreground) */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-vektrum-green transition-all duration-500"
            style={{ width: `${Math.min(100, releasedPct)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>
            {releasedPct.toFixed(0)}% released
          </span>
          <span>
            {fundedPct.toFixed(0)}% funded
          </span>
        </div>
      </div>
    </div>
  );
}
