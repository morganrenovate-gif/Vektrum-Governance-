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
  )
}
