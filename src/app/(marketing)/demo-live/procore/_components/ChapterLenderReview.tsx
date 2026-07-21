/**
 * Chapter Two — Lender review.
 * AI-assisted Draw Control Brief (informs) + deterministic 10-condition gate (decides)
 * + a clearly separated presenter-only "Simulated source update" panel.
 */
import { Sparkles, ArrowRight, FlaskConical } from 'lucide-react';
import { Card, Eyebrow, StatusBadge, KV } from './primitives';
import { currentPreReview, effectiveConditions, gateSummary } from '../_lib/machine';
import { AI_REQUIREMENT_LABEL } from '../_lib/fixtures';
import type { DemoContext } from '../_lib/types';

export function ChapterLenderReview({
  ctx, onStage, onReceive,
}: {
  ctx: DemoContext;
  onStage: (u: 'co_approved' | 'waiver_approved') => void;
  onReceive: () => void;
}) {
  const pre = currentPreReview(ctx);
  const conds = effectiveConditions(ctx);
  const g = gateSummary(ctx);
  const bothStaged = ctx.staged.co_approved && ctx.staged.waiver_approved;

  return (
    <div className="space-y-5">
      {/* AI-assisted Draw Control Brief */}
      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={18} className="text-vektrum-blue" aria-hidden={true} />
          <Eyebrow>AI-assisted draw pre-review — Draw Control Brief</Eyebrow>
        </div>
        <p className="mb-4 rounded-lg bg-vektrum-surface-alt px-3 py-2 text-[12px] text-vektrum-muted">
          AI-assisted pre-review identifies documentation gaps, conflicts, and risk signals.
          AI does not authorize a release.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KV k="Review status" v={pre.reviewStatus} />
          <KV k="Risk level" v={<StatusBadge status={pre.riskLevel === 'low' ? 'passed' : 'warning'} labelOverride={pre.riskLevel === 'low' ? 'Low' : 'Critical'} />} />
          <KV k="Readiness" v={pre.readiness} />
        </div>
        <ul className="mt-4 space-y-2">
          {pre.observations.map((o, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px]">
              <StatusBadge status={o.kind === 'blocking' ? 'blocked' : 'pending'} labelOverride={o.kind === 'blocking' ? 'Policy exception' : 'Observation'} />
              <span className="pt-0.5 text-vektrum-muted">{o.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-vektrum-border-subtle pt-3 font-mono text-[12px] text-vektrum-blue">
          AI informs; the gate decides.
        </p>
      </Card>

      {/* 10-condition release gate */}
      <Card>
        <Eyebrow>Deterministic 10-condition release gate</Eyebrow>
        <ul className="divide-y divide-vektrum-border-subtle">
          {conds.map((c) => (
            <li key={c.index} className="flex items-start justify-between gap-3 py-2.5">
              <div className="flex gap-3">
                <span className="mt-0.5 font-mono text-[12px] font-bold text-vektrum-faint">{String(c.index).padStart(2, '0')}</span>
                <div>
                  <p className="text-[13.5px] text-vektrum-text">{c.label}</p>
                  {c.status === 'not_applicable' && c.notApplicableReason && (
                    <p className="mt-0.5 text-[12px] text-vektrum-faint">{c.notApplicableReason}</p>
                  )}
                </div>
              </div>
              <StatusBadge status={c.status} />
            </li>
          ))}
          {/* AI-assisted requirement, shown separately */}
          <li className="flex items-start justify-between gap-3 py-2.5">
            <div className="flex gap-3">
              <span className="mt-0.5 font-mono text-[12px] font-bold text-vektrum-blue">AI</span>
              <p className="text-[13.5px] text-vektrum-text">{AI_REQUIREMENT_LABEL}</p>
            </div>
            <StatusBadge
              status={ctx.aiRequirementSatisfied ? 'passed' : 'blocked'}
              labelOverride={ctx.aiRequirementSatisfied ? 'Satisfied' : 'Unresolved critical risk'}
            />
          </li>
        </ul>
        <p className="mt-3 rounded-lg bg-vektrum-surface-alt px-3 py-2 text-[13px] font-semibold text-vektrum-text">
          {g.passed} passed · {g.notApplicable} not applicable · {g.blocked} blocked
          {g.aiUnresolved ? ' · AI pre-review unresolved' : ' · AI pre-review current'}
          {' · '}{g.authorizationAvailable ? 'Ready for funder authorization' : 'Authorization unavailable'}
        </p>
      </Card>

      {/* Presenter-only simulated source update — visually distinct */}
      <div className="rounded-2xl border-2 border-dashed border-vektrum-amber-border bg-vektrum-amber-bg p-5">
        <div className="mb-1 flex items-center gap-2">
          <FlaskConical size={18} className="text-vektrum-amber" aria-hidden={true} />
          <h3 className="text-[14px] font-bold uppercase tracking-wide text-vektrum-amber">Simulated source update</h3>
        </div>
        <p className="mb-4 max-w-3xl text-[12.5px] text-vektrum-muted">
          Presenter control only. These changes represent updates made by authorized users in the originating project
          workflow. Vektrum does not make these source changes.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { key: 'co_approved', label: 'Simulate CO-027 approved at source' },
            { key: 'waiver_approved', label: 'Simulate conditional lien waiver approved at source' },
          ] as const).map((btn) => {
            const on = ctx.staged[btn.key];
            return (
              <button
                key={btn.key} type="button" onClick={() => onStage(btn.key)} aria-pressed={on}
                className={`min-h-[44px] rounded-xl border px-4 py-3 text-left text-[13.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue ${
                  on ? 'border-vektrum-green-border bg-vektrum-green-bg text-vektrum-green'
                     : 'border-vektrum-border bg-vektrum-surface text-vektrum-text hover:bg-vektrum-surface-alt'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  {btn.label}
                  {on && <StatusBadge status="confirmed" labelOverride="Staged" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-center">
          <button
            type="button" onClick={onReceive} disabled={!bothStaged}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-vektrum-blue px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-vektrum-blue-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
          >
            Receive updated simulated snapshot <ArrowRight size={16} aria-hidden={true} />
          </button>
        </div>
        {!bothStaged && (
          <p className="mt-2 text-center text-[12px] text-vektrum-muted">
            Both simulated source updates must be staged before an updated snapshot can be received.
          </p>
        )}
      </div>
    </div>
  );
}
