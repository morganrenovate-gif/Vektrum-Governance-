import { CheckCircle2, Clock } from 'lucide-react'

interface DealSetupProgressProps {
  contractFullySigned:  boolean
  hasReleaseRulesDraft: boolean
  releaseRulesAccepted: boolean
  hasSovItems:          boolean
  sovApproved:          boolean
  allMilestonesLinked:  boolean
  releaseGateActive:    boolean
}

interface Step {
  label: string
  done:  boolean
}

export function DealSetupProgress({
  contractFullySigned,
  hasReleaseRulesDraft,
  releaseRulesAccepted,
  hasSovItems,
  sovApproved,
  allMilestonesLinked,
  releaseGateActive,
}: DealSetupProgressProps) {
  const steps: Step[] = [
    { label: 'Contract signed',         done: contractFullySigned },
    { label: 'Release rules drafted',   done: hasReleaseRulesDraft || releaseRulesAccepted },
    { label: 'Release rules approved',  done: releaseRulesAccepted },
    { label: 'SOV created',             done: hasSovItems },
    { label: 'SOV approved',            done: sovApproved },
    { label: 'Milestones linked',       done: allMilestonesLinked },
    { label: 'Release gate active',     done: releaseGateActive },
  ]

  const doneCount = steps.filter(s => s.done).length

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
          Deal setup progress
        </p>
        <span className="text-[11px] text-white/40 tabular-nums">
          {doneCount}/{steps.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="h-full rounded-full bg-vektrum-blue transition-all duration-500"
          style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-label={`${doneCount} of ${steps.length} setup steps complete`}
        />
      </div>

      {/* Step list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {steps.map(({ label, done }) => (
          <div key={label} className="flex items-center gap-2">
            {done
              ? <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
              : <Clock        size={12} className="text-white/20 flex-shrink-0"    aria-hidden="true" />
            }
            <span className={`text-[12px] ${done ? 'text-white/70' : 'text-white/30'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
