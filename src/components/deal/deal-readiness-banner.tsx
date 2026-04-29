import { CheckCircle2, Lock, Shield } from "lucide-react";

interface DealReadinessBannerProps {
  totalMilestones: number;
  releasedMilestones: number;
  approvedMilestones: number;
  releasableMilestones: number;
  topBlockers: string[];
  nextAction: string | null;
}

export function DealReadinessBanner({
  totalMilestones,
  releasedMilestones,
  approvedMilestones,
  releasableMilestones,
  topBlockers,
  nextAction,
}: DealReadinessBannerProps) {
  if (totalMilestones === 0) return null;

  const allReleased = releasedMilestones === totalMilestones;
  const someReleasable = releasableMilestones > 0;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-blue-400" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-widest text-white/65">
            Release Readiness
          </span>
        </div>
        {allReleased ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
            <CheckCircle2 size={12} aria-hidden="true" />
            All milestones released
          </span>
        ) : someReleasable ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
            <CheckCircle2 size={12} aria-hidden="true" />
            {releasableMilestones} ready to release
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
            <Lock size={11} aria-hidden="true" />
            Blocked by policy
          </span>
        )}
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-white/[0.06]">
        <ReadinessStat label="Total" value={totalMilestones} />
        <ReadinessStat
          label="Released"
          value={releasedMilestones}
          color={releasedMilestones > 0 ? "emerald" : "neutral"}
        />
        <ReadinessStat
          label="Approved"
          value={approvedMilestones}
          color={approvedMilestones > 0 ? "blue" : "neutral"}
        />
        <ReadinessStat
          label="Releasable"
          value={releasableMilestones}
          color={releasableMilestones > 0 ? "emerald" : "neutral"}
        />
      </div>

      {/* Next action + top blockers */}
      {(nextAction || topBlockers.length > 0) && (
        <div className="border-t border-white/[0.06] px-5 py-3 space-y-2">
          {nextAction && (
            <p className="text-xs text-white/70">
              <span className="font-semibold text-white/85">Required next action: </span>
              {nextAction}
            </p>
          )}
          {topBlockers.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1">
                Required before release
              </p>
              <ul className="space-y-0.5">
                {topBlockers.slice(0, 3).map((blocker, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/55">
                    <span
                      className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-400"
                      aria-hidden="true"
                    />
                    {blocker}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReadinessStat({
  label,
  value,
  color = "neutral",
}: {
  label: string;
  value: number;
  color?: "neutral" | "blue" | "emerald";
}) {
  const valueClass =
    color === "emerald" ? "text-emerald-400" :
    color === "blue"    ? "text-blue-400"    :
                          "text-white/85";
  return (
    <div className="flex flex-col items-center justify-center px-4 py-3 gap-0.5">
      <span className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-widest text-white/45">
        {label}
      </span>
    </div>
  );
}
