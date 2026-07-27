/**
 * Scenes 6–7 — Authorization recorded, simulated decision record, separate
 * external confirmation, and the closing positioning screen.
 *
 * Authorization and execution are visually distinct states throughout.
 */
import { CheckCircle2, Clock, Landmark, ShieldCheck } from 'lucide-react';
import { Card, Eyebrow, KV, StatusBadge, money, InertRef } from './primitives';
import {
  authorizationRecord, externalConfirmation, lenderPolicy, funder, project,
  RAIL_AUTHORIZED_LINE, PARTNER_CONFIRMED_LINE, WRITEBACK_STATUS_LINE,
  CLOSING_LINE_1, CLOSING_LINE_2,
} from '../_lib/fixtures';
import { snapshotId, buildAuditEvents } from '../_lib/machine';
import type { DemoContext } from '../_lib/types';

export function SceneDecision({
  ctx, onConfirm,
}: { ctx: DemoContext; onConfirm: () => void }) {
  const confirmed = ctx.externalConfirmationRecorded;

  return (
    <div className="space-y-4">
      {/* Authorization state — distinct from execution */}
      <Card className="border-vektrum-green-border bg-vektrum-green-bg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} className="mt-0.5 shrink-0 text-vektrum-green" aria-hidden={true} />
            <div>
              <h2 className="text-[20px] font-bold tracking-tight text-vektrum-green">Release authorized.</h2>
              <p className="mt-1 max-w-3xl text-[13.5px] text-vektrum-text">{RAIL_AUTHORIZED_LINE}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status="issued" labelOverride="Authorization: Recorded" />
            <StatusBadge
              status={confirmed ? 'confirmed' : 'pending'}
              labelOverride={confirmed ? 'External execution: Simulated as confirmed' : 'External execution: Awaiting external confirmation'}
            />
          </div>
        </div>
      </Card>

      {/* Simulated decision record returned to the project workspace */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Simulated project workspace · {project.name}</Eyebrow>
          <StatusBadge status="simulated" labelOverride="Conceptual activity card" />
        </div>
        <h3 className="text-[16px] font-bold text-vektrum-text">Simulated lender authorization record</h3>
        <dl className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KV k="Authorized by" v={`${funder.name} — ${funder.title}`} />
          <KV k="Authorized amount" v={money(authorizationRecord.authorizedGrossAmount)} />
          <KV k="Policy" v={lenderPolicy.name} />
          <KV k="Evidence snapshot" v={<InertRef>{snapshotId(ctx)}</InertRef>} />
          <KV k="Authorization ID" v={<InertRef>{authorizationRecord.authorizationId}</InertRef>} />
          <KV k="Execution state" v={confirmed ? 'Simulated as confirmed' : authorizationRecord.executionStatus} />
        </dl>
        <p className="mt-3 rounded-lg border border-vektrum-amber-border bg-vektrum-amber-bg px-3 py-2 text-[12px] font-medium text-vektrum-amber">
          {WRITEBACK_STATUS_LINE}
        </p>
      </Card>

      {/* Separate external execution confirmation */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-vektrum-surface-alt text-vektrum-muted">
              <Landmark size={22} aria-hidden={true} />
            </span>
            <div>
              <Eyebrow>Partner-controlled execution · Simulated</Eyebrow>
              <p className="text-[14px] font-bold text-vektrum-text">{externalConfirmation.confirmedBy}</p>
              {!confirmed ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-vektrum-muted">
                  <Clock size={14} aria-hidden={true} /> Execution remains with the external partner’s own process.
                </p>
              ) : (
                <div className="mt-1 space-y-0.5 text-[13px] text-vektrum-muted">
                  <p className="inline-flex items-center gap-1.5 font-medium text-vektrum-green">
                    <CheckCircle2 size={14} aria-hidden={true} /> {PARTNER_CONFIRMED_LINE}
                  </p>
                  <p>
                    Reference <InertRef>{externalConfirmation.confirmationReference}</InertRef> · {externalConfirmation.method} · {externalConfirmation.confirmedAt}
                  </p>
                </div>
              )}
            </div>
          </div>
          {!confirmed && (
            <button
              type="button" onClick={onConfirm}
              className="inline-flex min-h-[48px] items-center rounded-xl border border-vektrum-border bg-vektrum-surface px-5 py-3 text-[14px] font-bold text-vektrum-text hover:bg-vektrum-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
            >
              Record simulated partner confirmation
            </button>
          )}
        </div>
      </Card>

      {/* Audit timeline */}
      <Card>
        <Eyebrow>Simulated audit timeline</Eyebrow>
        <ol className="space-y-2">
          {buildAuditEvents(ctx).map((e) => (
            <li key={e.reference} className="text-[12.5px]">
              <span className="font-semibold text-vektrum-text">{e.eventType}</span>
              <span className="text-vektrum-muted"> — {e.actor} · {e.timestamp} · </span>
              <InertRef>{e.reference}</InertRef>
            </li>
          ))}
        </ol>
      </Card>

      {/* Closing positioning — only at the end of the walkthrough */}
      {confirmed && (
        <div className="rounded-2xl border border-white/10 bg-vektrum-canvas p-6 text-white shadow-sm">
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300">
            The complementary model
          </p>
          <h3 className="max-w-4xl text-[20px] font-bold tracking-tight text-white">{CLOSING_LINE_1}</h3>
          <p className="mt-2 text-[16px] font-semibold text-blue-200">{CLOSING_LINE_2}</p>
          <ul className="mt-4 grid gap-1.5 text-[13px] text-white/75 sm:grid-cols-2">
            <li>· Procore remains the project system of record.</li>
            <li>· Every required condition must pass — no bypass.</li>
            <li>· The exception maps to a precise financial impact.</li>
            <li>· A funder explicitly authorizes; AI informs, the gate decides.</li>
            <li>· Authorization and payment execution remain separate.</li>
            <li>· Production data synchronization and write-back are planned, not implemented.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
