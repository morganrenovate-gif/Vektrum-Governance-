/**
 * Chapter Two — Isolate the exception, authorize eligible work.
 *
 * AI-assisted pre-review (informs) contains two policy exceptions to ONE release
 * unit. The deterministic gate for that unit shows exactly which conditions fail.
 * Three unrelated units stay eligible and reconcile exactly — so the funder can
 * authorize them now while the contained unit waits. AI never authorizes.
 */
import { Sparkles, ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { Card, Eyebrow, StatusBadge, KV, money } from './primitives';
import { ReleaseUnitsTable, ReconciliationSummary } from './ReleaseUnits';
import {
  currentPreReview, effectiveConditions, gateSummary, releaseUnitViews,
  drawReconciliation, authorizationScope, canAuthorizeEligible,
} from '../_lib/machine';
import { AI_REQUIREMENT_LABEL, releaseUnits, ISOLATED_UNIT_ID, SIMULATED_DEMO_NOTE } from '../_lib/fixtures';
import type { DemoContext } from '../_lib/types';

export function ChapterLenderReview({
  ctx, onOpenAuthorizeEligible,
}: {
  ctx: DemoContext;
  onOpenAuthorizeEligible: () => void;
}) {
  const pre = currentPreReview(ctx);
  const conds = effectiveConditions(ctx);
  const g = gateSummary(ctx);
  const units = releaseUnitViews(ctx);
  const recon = drawReconciliation(ctx);
  const scope = authorizationScope(ctx);
  const isolated = releaseUnits.find((u) => u.id === ISOLATED_UNIT_ID)!;
  const canAuth = canAuthorizeEligible(ctx);

  return (
    <div className="space-y-5">
      <p role="note" className="rounded-lg bg-vektrum-surface-alt px-3 py-2 text-[12px] text-vektrum-muted">
        {SIMULATED_DEMO_NOTE}
      </p>

      {/* AI-assisted Draw Control Brief */}
      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={18} className="text-vektrum-blue" aria-hidden={true} />
          <Eyebrow>AI-assisted draw pre-review — Draw Control Brief</Eyebrow>
        </div>
        <p className="mb-4 rounded-lg bg-vektrum-surface-alt px-3 py-2 text-[12px] text-vektrum-muted">
          AI-assisted pre-review identifies documentation gaps, conflicts, and risk signals and contains them to the
          affected unit. AI does not authorize a release.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KV k="Review status" v={pre.reviewStatus} />
          <KV k="Risk level" v={<StatusBadge status={pre.riskLevel === 'low' ? 'passed' : 'warning'} labelOverride={pre.riskLevel === 'low' ? 'Low' : 'Critical (contained)'} />} />
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

      {/* Release units — one isolated, three eligible */}
      <ReleaseUnitsTable units={units} />

      {/* Reconciliation summary */}
      <ReconciliationSummary recon={recon} scope={scope} />

      {/* Isolated-unit detail: exactly which conditions fail + evidence + deps */}
      <Card className="border-vektrum-red-border bg-vektrum-red-bg">
        <div className="mb-1 flex items-center gap-2">
          <Lock size={18} className="text-vektrum-red" aria-hidden={true} />
          <Eyebrow>Contained unit — {isolated.sovLine} · {money(isolated.grossAmount)} gross</Eyebrow>
        </div>
        <p className="text-[13px] text-vektrum-text">{isolated.label}</p>
        <p className="mt-1 text-[12.5px] text-vektrum-muted">{isolated.isolationReason}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-vektrum-faint">Failed conditions</p>
            <ul className="space-y-1.5 text-[13px] text-vektrum-muted">
              {(isolated.failedConditions ?? []).map((c) => (
                <li key={c} className="flex gap-2"><StatusBadge status="blocked" labelOverride="Fails" />{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-vektrum-faint">Evidence references</p>
            <div className="flex flex-wrap gap-1.5">
              {(isolated.evidenceRefs ?? []).map((r) => (
                <code key={r} className="rounded bg-vektrum-surface px-1.5 py-0.5 font-mono text-[12px] text-vektrum-muted">{r}</code>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-vektrum-muted">
              Dependency check: <span className="font-semibold text-vektrum-text">0 eligible units depend on this unit.</span>{' '}
              A genuinely dependent unit would be held automatically until this one clears.
            </p>
          </div>
        </div>
      </Card>

      {/* Gate detail for the isolated unit (informational) */}
      <Card>
        <Eyebrow>Deterministic 10-condition gate — contained unit</Eyebrow>
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
          <li className="flex items-start justify-between gap-3 py-2.5">
            <div className="flex gap-3">
              <span className="mt-0.5 font-mono text-[12px] font-bold text-vektrum-blue">AI</span>
              <p className="text-[13.5px] text-vektrum-text">{AI_REQUIREMENT_LABEL}</p>
            </div>
            <StatusBadge status={ctx.isolatedResolved ? 'passed' : 'blocked'} labelOverride={ctx.isolatedResolved ? 'Satisfied' : 'Unresolved (this unit)'} />
          </li>
        </ul>
        <p className="mt-3 rounded-lg bg-vektrum-surface-alt px-3 py-2 text-[13px] font-semibold text-vektrum-text">
          Contained unit: {g.passed} passed · {g.notApplicable} not applicable · {g.blocked} blocked · three other units eligible
        </p>
      </Card>

      {/* Authorize the eligible units now */}
      <Card className="border-vektrum-green-border bg-vektrum-green-bg">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-vektrum-green" aria-hidden={true} />
          <h3 className="text-[17px] font-bold tracking-tight text-vektrum-text">Authorize the eligible units — {money(scope.netAmount)} net</h3>
        </div>
        <p className="mt-1 max-w-3xl text-[14px] text-vektrum-muted">
          The three eligible units passed every applicable condition. The funder may authorize them now. The contained
          steel unit is excluded from this authorization and continues to be held.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KV k="Units in scope" v={`${scope.unitIds.length} eligible`} />
          <KV k="Excluded (isolated)" v={`${scope.excludedIsolatedUnitIds.length} unit`} />
          <KV k="Authorizable net" v={money(scope.netAmount)} />
        </div>
        <div className="mt-5 flex justify-center">
          <button
            type="button" onClick={onOpenAuthorizeEligible} disabled={!canAuth}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-vektrum-blue px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-vektrum-blue-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
          >
            Authorize eligible units <ArrowRight size={16} aria-hidden={true} />
          </button>
        </div>
      </Card>
    </div>
  );
}
