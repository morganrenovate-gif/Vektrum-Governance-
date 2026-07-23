/**
 * Chapter Three — Resolve the contained unit, then re-authorize it separately.
 *
 * The eligible units are already authorized. Now the isolated unit's exceptions
 * are corrected at source (presenter-only simulation), Vektrum receives an updated
 * snapshot, the unit is re-evaluated, and the funder records a SEPARATE
 * authorization for just that unit — without touching the earlier one.
 */
import { ShieldCheck, ArrowRight, FlaskConical, CheckCircle2 } from 'lucide-react';
import { Card, Eyebrow, KV, StatusBadge, money } from './primitives';
import { ReleaseUnitsTable, ReconciliationSummary } from './ReleaseUnits';
import {
  releaseUnitViews, drawReconciliation, authorizationScope,
  canAuthorizeResolved, currentPreReview,
} from '../_lib/machine';
import { authEligible, funder } from '../_lib/fixtures';
import type { DemoContext } from '../_lib/types';

export function ChapterAuthorization({
  ctx, onStage, onReceive, onOpenAuthorizeResolved,
}: {
  ctx: DemoContext;
  onStage: (u: 'co_approved' | 'waiver_approved') => void;
  onReceive: () => void;
  onOpenAuthorizeResolved: () => void;
}) {
  const bothStaged = ctx.staged.co_approved && ctx.staged.waiver_approved;
  const units = releaseUnitViews(ctx);
  const recon = drawReconciliation(ctx);
  const scope = authorizationScope(ctx);
  const pre = currentPreReview(ctx);
  const canAuth = canAuthorizeResolved(ctx);

  return (
    <div className="space-y-5">
      {/* Round-1 authorization confirmation */}
      <Card className="border-vektrum-blue-border">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-vektrum-green" aria-hidden={true} />
          <Eyebrow>Eligible units authorized — {money(authEligible.authorizedNetAmount)} net</Eyebrow>
        </div>
        <p className="text-[13px] text-vektrum-muted">
          {authEligible.includedUnitIds.length} units authorized by {funder.name}. The contained steel unit was
          excluded. Vektrum executed no payment.
        </p>
      </Card>

      {/* Presenter-only simulated source update for the CONTAINED unit */}
      <div className="rounded-2xl border-2 border-dashed border-vektrum-amber-border bg-vektrum-amber-bg p-5">
        <div className="mb-1 flex items-center gap-2">
          <FlaskConical size={18} className="text-vektrum-amber" aria-hidden={true} />
          <h3 className="text-[14px] font-bold uppercase tracking-wide text-vektrum-amber">
            Simulated source update — contained unit only
          </h3>
        </div>
        <p className="mb-4 max-w-3xl text-[12.5px] text-vektrum-muted">
          Presenter control only. These changes represent corrections made by authorized users in the originating
          project workflow for the structural-steel unit. Vektrum does not make these source changes.
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
            type="button" onClick={onReceive} disabled={!bothStaged || ctx.isolatedResolved}
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

      {/* After resolution: re-evaluation + separate authorization */}
      {ctx.isolatedResolved && (
        <>
          <ReleaseUnitsTable units={units} />
          <ReconciliationSummary recon={recon} scope={scope} />

          <Card className="border-vektrum-green-border bg-vektrum-green-bg">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-vektrum-green" aria-hidden={true} />
              <h3 className="text-[17px] font-bold tracking-tight text-vektrum-text">
                Contained unit re-evaluated — authorize separately ({money(scope.netAmount)} net)
              </h3>
            </div>
            <p className="mt-1 max-w-3xl text-[14px] text-vektrum-muted">
              The steel unit’s conditions 7 and 10 now pass and risk is {pre.riskLevel}. It re-enters eligibility and
              receives its OWN authorization record — the earlier eligible-unit authorization is unchanged.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <KV k="Unit in scope" v={`${scope.unitIds.length} (resolved)`} />
              <KV k="Deterministic gate" v={<StatusBadge status="passed" />} />
              <KV k="Authorizable net" v={money(scope.netAmount)} />
            </div>
            <div className="mt-5 flex justify-center">
              <button
                type="button" onClick={onOpenAuthorizeResolved} disabled={!canAuth}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-vektrum-blue px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-vektrum-blue-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
              >
                Authorize resolved unit <ArrowRight size={16} aria-hidden={true} />
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
