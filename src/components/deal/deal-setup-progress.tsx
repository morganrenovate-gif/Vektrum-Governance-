<<<<<<< HEAD
/**
 * DealSetupProgress — horizontal 7-step setup-progress strip for the
 * deal detail page. Server-rendered. Each step has one of three tones:
 *
 *   - done     : ✓ emerald
 *   - active   : • amber, pulsing — the current next required step
 *   - upcoming : ◯ neutral
 *
 * The strip is purely informational: it does NOT affect release gate,
 * SOV approval, or payment execution. Its job is to make the
 * post-approval state legible — i.e. distinguish "Draft accepted" from
 * "SOV approved" from "Release gate active".
 *
 * Inputs are flat booleans computed server-side from the same source data
 * the deal page already uses (contract, sovItems, milestones, draft).
 */

import { CheckCircle2, Circle } from 'lucide-react'

export interface DealSetupProgressProps {
  contractFullySigned:    boolean
  hasReleaseRulesDraft:   boolean
  releaseRulesAccepted:   boolean
  hasSovItems:            boolean
  sovApproved:            boolean
  allMilestonesLinked:    boolean
  releaseGateActive:      boolean
}

export function DealSetupProgress(props: DealSetupProgressProps) {
  const steps: Array<{ label: string; done: boolean }> = [
    { label: 'Contract signed',          done: props.contractFullySigned },
    { label: 'Release rules drafted',    done: props.hasReleaseRulesDraft || props.releaseRulesAccepted || props.hasSovItems },
    { label: 'Release rules accepted',   done: props.releaseRulesAccepted || props.sovApproved },
    { label: 'SOV created',              done: props.hasSovItems },
    { label: 'SOV approved',             done: props.sovApproved },
    { label: 'Milestones linked',        done: props.allMilestonesLinked },
    { label: 'Release gate active',      done: props.releaseGateActive },
  ]

  // The "active" step is the first incomplete step. Anything before it is
  // done; anything after is upcoming.
  const activeIdx = steps.findIndex((s) => !s.done)

  return (
    <section
      aria-label="Deal setup progress"
      className="rounded-xl border border-white/[0.07] bg-surface-2 px-4 py-3"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
          Deal setup progress
        </p>
        <span className="text-[10px] text-white/35">
          {steps.filter((s) => s.done).length} / {steps.length} complete
        </span>
      </div>

      <ol
        className="flex flex-wrap items-center gap-x-3 gap-y-2"
        // The list is ordered semantically; visually we render with separators
        // between items so a screen reader hears "1 of 7", "2 of 7", etc.
      >
        {steps.map((step, i) => {
          const isActive = i === activeIdx
          const tone =
            step.done ? 'done' :
            isActive  ? 'active' :
                        'upcoming'
          return (
            <li
              key={step.label}
              className="flex items-center gap-1.5"
              aria-current={isActive ? 'step' : undefined}
            >
              {tone === 'done' ? (
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
              ) : tone === 'active' ? (
                <span
                  className="inline-block h-3 w-3 rounded-full bg-amber-400 ring-2 ring-amber-400/30 animate-pulse-slow flex-shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Circle size={12} className="text-white/25 flex-shrink-0" aria-hidden="true" />
              )}
              <span className={`text-[12px] ${
                tone === 'done'   ? 'text-white/70 line-through decoration-white/15' :
                tone === 'active' ? 'text-amber-300 font-semibold' :
                                    'text-white/35'
              }`}>
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <span aria-hidden="true" className="ml-1 text-white/15">→</span>
              )}
            </li>
          )
        })}
      </ol>

      <p className="mt-2.5 text-[10px] text-white/35 leading-relaxed">
        Setup progress is informational. Release authorization remains separate
        and depends on the deterministic release gate plus explicit funder action.
        The selected rail executes disbursement.
      </p>
    </section>
=======
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
>>>>>>> origin/claude/lucid-dubinsky-5f21ed
  )
}
