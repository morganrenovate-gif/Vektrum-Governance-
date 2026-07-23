/**
 * Chapter Four — Execution evidence & audit.
 * TWO distinct authorization records (eligible units, then the resolved unit).
 * Vektrum records authorization; the selected external process executes and returns
 * confirmation evidence. No execution occurs in this prototype.
 */
import { ArrowRight, Landmark, ShieldCheck } from 'lucide-react';
import { Card, Eyebrow, KV, StatusBadge, money, InertRef } from './primitives';
import { authEligible, authResolved, externalConfirmation, project, EXECUTION_NOTE } from '../_lib/fixtures';
import type { AuthorizationRecord, DemoContext } from '../_lib/types';

function AuthCard({ rec, confirmed, kicker }: { rec: AuthorizationRecord; confirmed: boolean; kicker: string }) {
  return (
    <Card className="border-vektrum-blue-border">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>{kicker}</Eyebrow>
        <StatusBadge status="issued" labelOverride="Issued — simulated" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KV k="Authorization ID" v={<InertRef>{rec.authorizationId}</InertRef>} />
        <KV k="Reference ID" v={<InertRef>{rec.referenceId}</InertRef>} />
        <KV k="Rail scope" v={rec.railScope} />
        <KV k="Authorized by" v={`${rec.authorizedBy} · ${rec.role}`} />
        <KV k="Authorized at" v={rec.authorizedAt} />
        <KV k="Authorized net" v={money(rec.authorizedNetAmount)} />
        <KV k="Bound units" v={rec.includedUnitIds.join(', ')} />
        <KV k="Excluded (isolated)" v={rec.excludedUnitIds.length ? rec.excludedUnitIds.join(', ') : 'None'} />
        <KV k="Execution status" v={confirmed
          ? <StatusBadge status="confirmed" labelOverride="Confirmed — simulated" />
          : <StatusBadge status="pending" labelOverride="Awaiting external confirmation" />} />
      </div>
    </Card>
  );
}

export function ChapterExecutionEvidence({ ctx, onConfirm }: { ctx: DemoContext; onConfirm: () => void }) {
  const confirmed = ctx.externalConfirmationRecorded;
  return (
    <div className="space-y-5">
      <Card className="bg-vektrum-blue-subtle">
        <h3 className="text-[16px] font-bold tracking-tight text-vektrum-blue">
          One draw, two scoped authorizations — the isolated amount never leaked.
        </h3>
        <p className="mt-1 max-w-3xl text-[13px] text-vektrum-muted">{EXECUTION_NOTE}</p>
      </Card>

      {/* Both authorization records */}
      <AuthCard rec={authEligible} confirmed={confirmed} kicker="Authorization 1 — eligible units (excludes isolated)" />
      <AuthCard rec={authResolved} confirmed={confirmed} kicker="Authorization 2 — resolved unit (separate record)" />

      <p className="rounded-lg bg-vektrum-blue-subtle px-3 py-2 text-[13px] font-semibold text-vektrum-blue">
        Authorization demonstrated; no payment executed. Total authorized net{' '}
        {money(authEligible.authorizedNetAmount + authResolved.authorizedNetAmount)} across two independent records.
      </p>

      {/* Boundary: Vektrum vs external process */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={18} className="text-vektrum-blue" aria-hidden={true} />
            <h4 className="text-[13px] font-bold uppercase tracking-wide text-vektrum-text">Vektrum</h4>
          </div>
          <ul className="space-y-1.5 text-[13px] text-vektrum-muted">
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>Two lender authorizations recorded, each scoped to specific units</li>
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>Gate results recorded per unit</li>
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>Governed evidence snapshot referenced</li>
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>Awaiting external confirmation</li>
          </ul>
        </Card>
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <Landmark size={18} className="text-vektrum-blue" aria-hidden={true} />
            <h4 className="text-[13px] font-bold uppercase tracking-wide text-vektrum-text">External partner-controlled process</h4>
          </div>
          <ul className="space-y-1.5 text-[13px] text-vektrum-muted">
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>Receives authorization references through a future approved workflow</li>
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>Independently executes through existing infrastructure</li>
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>Returns execution status or confirmation evidence</li>
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>No execution occurs in this prototype</li>
          </ul>
        </Card>
      </div>

      {!confirmed ? (
        <div className="space-y-2">
          <div className="flex justify-center">
            <button
              type="button" onClick={onConfirm}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-vektrum-blue px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-vektrum-blue-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
            >
              Simulate external confirmation <ArrowRight size={16} aria-hidden={true} />
            </button>
          </div>
          <p className="text-center text-[12px] text-vektrum-muted">
            Demo-only state transition. No API request, bank instruction, wire, transfer, or payment is performed.
          </p>
        </div>
      ) : (
        <Card className="border-vektrum-green-border bg-vektrum-green-bg">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>External confirmation — simulated</Eyebrow>
            <StatusBadge status="confirmed" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <KV k="Execution status" v={externalConfirmation.executionStatus} />
            <KV k="Method" v={externalConfirmation.method} />
            <KV k="Confirmation reference" v={<InertRef>{externalConfirmation.confirmationReference}</InertRef>} />
            <KV k="Confirmed by" v={externalConfirmation.confirmedBy} />
            <KV k="Confirmed at" v={externalConfirmation.confirmedAt} />
            <KV k="Execution partner" v={project.disbursementPartner} />
          </div>
          <p className="mt-4 text-[14px] font-semibold text-vektrum-text">
            Authorization and simulated execution confirmation recorded.
          </p>
          <p className="mt-1 max-w-3xl text-[13px] text-vektrum-muted">
            Vektrum records what the lender authorized per unit, which policy conditions passed, who authorized each
            release, and the confirmation reference returned by the external process.
          </p>
        </Card>
      )}
    </div>
  );
}
