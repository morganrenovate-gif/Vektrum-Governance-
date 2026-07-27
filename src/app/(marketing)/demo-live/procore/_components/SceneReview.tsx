/**
 * Scenes 2–5 — Simulated evidence evaluation, financial-impact AHA,
 * resolve-at-source, and the eligibility transformation.
 *
 * The amount bar connects the exception to a precise share of the requested
 * capital. This is a gross-scope evaluation view — NOT partial-authorization:
 * authorization stays all-or-nothing on the draw.
 */
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Card, Eyebrow, KV, StatusBadge, money, InertRef } from './primitives';
import {
  draw, changeOrder, lienWaiver, lenderPolicy, evidence, conceptualMappings,
  MAPPING_CAVEAT, IMPACT_STATEMENT, IMPACT_EXPLANATION, IMPACT_INSIGHT,
  REEVALUATING_LINE, AI_REQUIREMENT_LABEL, funder,
} from '../_lib/fixtures';
import {
  effectiveConditions, gateSummary, financialImpact, currentPreReview,
  snapshotId, snapshotTimestamp, buildAuditEvents, canAuthorize,
} from '../_lib/machine';
import type { DemoContext, SourceRecordKey } from '../_lib/types';

function Drawer({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-vektrum-border bg-vektrum-surface">
      <summary className="cursor-pointer select-none rounded-xl px-4 py-3 text-[13px] font-semibold text-vektrum-text hover:bg-vektrum-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-vektrum-blue">
        {summary}
      </summary>
      <div className="border-t border-vektrum-border px-4 py-3">{children}</div>
    </details>
  );
}

export function SceneReview({
  ctx, reevaluating, onResolve, onOpenAuthorize,
}: {
  ctx: DemoContext;
  reevaluating: SourceRecordKey | null;
  onResolve: (r: SourceRecordKey) => void;
  onOpenAuthorize: () => void;
}) {
  const fi = financialImpact(ctx);
  const g = gateSummary(ctx);
  const pre = currentPreReview(ctx);
  const conds = effectiveConditions(ctx);
  const resolved = g.blocked === 0;
  const coApproved = ctx.changeOrderStatus === 'approved';
  const waiverApproved = ctx.lienWaiverStatus === 'approved';
  const affectedPct = Math.round((fi.affected / fi.grossRequested) * 1000) / 10; // 7.3

  return (
    <div className="space-y-4">
      {/* Result banner */}
      {!resolved ? (
        <Card className="border-vektrum-red-border bg-vektrum-red-bg">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="mt-0.5 shrink-0 text-vektrum-red" aria-hidden={true} />
              <div>
                <h2 className="text-[22px] font-bold tracking-tight text-vektrum-red">
                  {money(fi.affected)} requires resolution.
                </h2>
                <p className="mt-1 max-w-3xl text-[13.5px] text-vektrum-text">{IMPACT_EXPLANATION}</p>
                <p className="mt-1 max-w-3xl text-[13.5px] text-vektrum-text">
                  The conditional lien waiver is present but not approved.
                </p>
              </div>
            </div>
            <StatusBadge status="simulated" labelOverride="Simulated evaluation" />
          </div>
        </Card>
      ) : (
        <Card className="border-vektrum-green-border bg-vektrum-green-bg">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldCheck size={22} className="mt-0.5 shrink-0 text-vektrum-green" aria-hidden={true} />
              <div>
                <h2 className="text-[22px] font-bold tracking-tight text-vektrum-green">
                  All required conditions satisfied.
                </h2>
                <p className="mt-1 max-w-3xl text-[13.5px] text-vektrum-text">
                  Both exceptions were resolved in the simulated project workspace. Condition 4 remains
                  Not applicable for the external rail. Authorization is now available to the funder.
                </p>
              </div>
            </div>
            <StatusBadge status="passed" labelOverride="Ready for authorization" />
          </div>
        </Card>
      )}

      {/* Financial-impact bar — the AHA */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Gross-scope evaluation · {draw.drawNumber}</Eyebrow>
          <p className="text-[12px] text-vektrum-faint">
            Evidence snapshot <InertRef>{snapshotId(ctx)}</InertRef> · {snapshotTimestamp(ctx)}
          </p>
        </div>

        <div className="mt-2 flex items-baseline gap-3">
          <p className="text-[24px] font-bold tracking-tight text-vektrum-text">{money(fi.grossRequested)}</p>
          <p className="text-[13px] text-vektrum-muted">gross requested · release unit: {fi.releaseUnit}</p>
        </div>

        {/* Amount bar */}
        <div
          className="mt-3 flex h-9 w-full overflow-hidden rounded-lg border border-vektrum-border"
          role="img"
          aria-label={`${money(fi.unaffected)} unaffected evaluated gross scope; ${money(fi.affected)} affected by CO-027${fi.isolated > 0 ? ', isolated for review' : ', resolved'}`}
        >
          <div className="grid place-items-center bg-vektrum-blue text-[12px] font-semibold text-white" style={{ width: `${100 - affectedPct}%` }}>
            {money(fi.unaffected)} unaffected
          </div>
          <div
            className={`grid min-w-[120px] place-items-center text-[12px] font-semibold ${fi.isolated > 0 ? 'bg-vektrum-red text-white' : 'bg-vektrum-green text-white'}`}
            style={{ width: `${affectedPct}%` }}
          >
            {money(fi.affected)} {fi.isolated > 0 ? 'CO-027' : 'resolved'}
          </div>
        </div>

        <p className="mt-2 text-[13px] font-medium text-vektrum-text">{IMPACT_STATEMENT}</p>
        <p className="mt-1 text-[12.5px] text-vektrum-muted">{IMPACT_INSIGHT}</p>

        {/* Condition + AI summary chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-vektrum-green-border bg-vektrum-green-bg px-3 py-1 text-[12px] font-semibold text-vektrum-green">{g.passed} passed</span>
          <span className="rounded-full border border-vektrum-border bg-vektrum-surface-alt px-3 py-1 text-[12px] font-semibold text-vektrum-muted">{g.notApplicable} not applicable (external rail)</span>
          <span className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${g.blocked > 0 ? 'border-vektrum-red-border bg-vektrum-red-bg text-vektrum-red' : 'border-vektrum-green-border bg-vektrum-green-bg text-vektrum-green'}`}>{g.blocked} blocked</span>
          <span className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${g.aiUnresolved ? 'border-vektrum-amber-border bg-vektrum-amber-bg text-vektrum-amber' : 'border-vektrum-green-border bg-vektrum-green-bg text-vektrum-green'}`}>
            AI-assisted pre-review: {g.aiUnresolved ? 'needs resolution' : 'resolved'} (informs — the gate decides)
          </span>
        </div>
      </Card>

      {/* Resolve at the simulated source */}
      <Card>
        <Eyebrow>Resolve at the simulated source</Eyebrow>
        <p className="mb-3 max-w-3xl text-[13px] text-vektrum-muted">
          Corrections happen in the simulated project workspace — not in a Vektrum override. Each
          correction produces the next evidence snapshot and re-evaluates the demonstrated lender policy.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {/* CO-027 */}
          <div className="rounded-xl border border-vektrum-border bg-vektrum-surface-alt p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] font-bold text-vektrum-text">Change Order {changeOrder.id}</p>
              <StatusBadge status={coApproved ? 'passed' : 'pending'} labelOverride={coApproved ? 'Approved' : 'Pending'} />
            </div>
            <p className="mt-1 text-[12.5px] text-vektrum-muted">{changeOrder.description} · {money(changeOrder.amount)}</p>
            {reevaluating === 'co_027' ? (
              <p className="mt-3 inline-flex items-center gap-2 text-[12.5px] font-medium text-vektrum-blue">
                <Loader2 size={14} className="animate-spin" aria-hidden={true} /> {REEVALUATING_LINE}
              </p>
            ) : coApproved ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-vektrum-green">
                <CheckCircle2 size={14} aria-hidden={true} /> Approved in simulated source · condition 7 re-evaluated
              </p>
            ) : (
              <button
                type="button" onClick={() => onResolve('co_027')} disabled={reevaluating !== null}
                className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-vektrum-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
              >
                Approve in simulated source
              </button>
            )}
          </div>

          {/* Lien waiver */}
          <div className="rounded-xl border border-vektrum-border bg-vektrum-surface-alt p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] font-bold text-vektrum-text">{lienWaiver.waiverType}</p>
              <StatusBadge status={waiverApproved ? 'passed' : 'pending'} labelOverride={waiverApproved ? 'Approved' : 'Unapproved'} />
            </div>
            <p className="mt-1 text-[12.5px] text-vektrum-muted">
              <InertRef>{lienWaiver.id}</InertRef> · {money(lienWaiver.amount)} (net)
            </p>
            {reevaluating === 'lien_waiver' ? (
              <p className="mt-3 inline-flex items-center gap-2 text-[12.5px] font-medium text-vektrum-blue">
                <Loader2 size={14} className="animate-spin" aria-hidden={true} /> {REEVALUATING_LINE}
              </p>
            ) : waiverApproved ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-vektrum-green">
                <CheckCircle2 size={14} aria-hidden={true} /> Approved in simulated source · condition 10 re-evaluated
              </p>
            ) : (
              <button
                type="button" onClick={() => onResolve('lien_waiver')} disabled={reevaluating !== null}
                className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-vektrum-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
              >
                Approve in simulated source
              </button>
            )}
          </div>
        </div>

        {/* Primary action when eligible */}
        {resolved && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-vektrum-border pt-4">
            <p className="text-[13px] text-vektrum-muted">
              Only the represented funder — {funder.name}, {funder.title}, {funder.organization} — may authorize.
            </p>
            <button
              type="button" onClick={onOpenAuthorize} disabled={!canAuthorize(ctx)}
              className="inline-flex min-h-[48px] items-center rounded-xl bg-vektrum-blue px-6 py-3 text-[14px] font-bold text-white hover:bg-vektrum-blue-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
            >
              Authorize release
            </button>
          </div>
        )}
      </Card>

      {/* Detail drawers */}
      <div className="grid gap-3 md:grid-cols-2">
        <Drawer summary="View source records">
          <ul className="space-y-1.5">
            {evidence.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="text-vektrum-text">{e.label}</span>
                <InertRef>{e.id}</InertRef>
              </li>
            ))}
          </ul>
        </Drawer>

        <Drawer summary="View AI-assisted pre-review">
          <p className="mb-2 text-[12px] text-vektrum-muted">
            Requirement: {AI_REQUIREMENT_LABEL}. AI informs; the deterministic gate decides.
          </p>
          <ul className="space-y-1.5">
            {pre.observations.map((o) => (
              <li key={o.text} className="flex items-start gap-2 text-[12.5px]">
                {o.kind === 'blocking'
                  ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-vektrum-red" aria-hidden={true} />
                  : <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-vektrum-green" aria-hidden={true} />}
                <span className="text-vektrum-text">{o.text}</span>
              </li>
            ))}
          </ul>
        </Drawer>

        <Drawer summary="View 10-condition gate">
          <ol className="space-y-1.5">
            {conds.map((c) => (
              <li key={c.index} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-vektrum-text">{c.index}. {c.label}</span>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11.5px] text-vektrum-faint">
            Condition 4 is Not applicable on the external partner-controlled rail and is never shown as passed.
          </p>
        </Drawer>

        <Drawer summary="View evidence snapshot">
          <dl className="grid grid-cols-2 gap-3">
            <KV k="Snapshot" v={<InertRef>{snapshotId(ctx)}</InertRef>} />
            <KV k="As of" v={snapshotTimestamp(ctx)} />
            <KV k="Policy" v={lenderPolicy.name} />
            <KV k="Evaluation mode" v={lenderPolicy.evaluationMode} />
          </dl>
        </Drawer>

        <Drawer summary="View simulated audit events">
          <ol className="space-y-2">
            {buildAuditEvents(ctx).map((e) => (
              <li key={e.reference} className="text-[12.5px]">
                <span className="font-semibold text-vektrum-text">{e.eventType}</span>
                <span className="text-vektrum-muted"> — {e.actor} · {e.timestamp} · </span>
                <InertRef>{e.reference}</InertRef>
                <p className="text-vektrum-muted">{e.explanation}</p>
              </li>
            ))}
          </ol>
        </Drawer>

        <Drawer summary="View conceptual integration mapping">
          <p className="mb-2 rounded-lg border border-vektrum-amber-border bg-vektrum-amber-bg px-3 py-2 text-[12px] font-semibold text-vektrum-amber">
            {MAPPING_CAVEAT}
          </p>
          <ul className="space-y-1.5">
            {conceptualMappings.map((m) => (
              <li key={m.sourceConcept} className="text-[12.5px] text-vektrum-text">
                {m.sourceConcept} → {m.destinationConcept}
                <span className="text-vektrum-faint"> · conceptual</span>
              </li>
            ))}
          </ul>
        </Drawer>
      </div>
    </div>
  );
}
