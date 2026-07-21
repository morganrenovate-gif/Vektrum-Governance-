/**
 * Chapter Four — Execution evidence.
 * Vektrum records authorization; the selected external process executes and returns
 * confirmation evidence. No execution occurs in this prototype.
 */
import { ArrowRight, Landmark, ShieldCheck } from 'lucide-react';
import { Card, Eyebrow, KV, StatusBadge, money, InertRef } from './primitives';
import { authorizationRecord, externalConfirmation, project } from '../_lib/fixtures';
import type { DemoContext } from '../_lib/types';

export function ChapterExecutionEvidence({ ctx, onConfirm }: { ctx: DemoContext; onConfirm: () => void }) {
  const confirmed = ctx.externalConfirmationRecorded;
  return (
    <div className="space-y-5">
      {/* Issued authorization record */}
      <Card className="border-vektrum-blue-border">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Recorded authorization — simulated</Eyebrow>
          <StatusBadge status="issued" labelOverride="Issued — simulated" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KV k="Authorization ID" v={<InertRef>{authorizationRecord.authorizationId}</InertRef>} />
          <KV k="Reference ID" v={<InertRef>{authorizationRecord.referenceId}</InertRef>} />
          <KV k="Rail scope" v={authorizationRecord.railScope} />
          <KV k="Authorized by" v={`${authorizationRecord.authorizedBy} · ${authorizationRecord.role}`} />
          <KV k="Authorized at" v={authorizationRecord.authorizedAt} />
          <KV k="Authorized gross amount" v={money(authorizationRecord.authorizedGrossAmount)} />
          <KV k="Expiration" v={authorizationRecord.expiration} />
          <KV k="Signature status" v={<StatusBadge status="simulated" labelOverride="Simulated / inert" />} />
          <KV k="Execution status" v={confirmed
            ? <StatusBadge status="confirmed" labelOverride="Confirmed — simulated" />
            : <StatusBadge status="pending" labelOverride="Awaiting external confirmation" />} />
        </div>
        <p className="mt-4 rounded-lg bg-vektrum-blue-subtle px-3 py-2 text-[13px] font-semibold text-vektrum-blue">
          Authorization demonstrated; no payment executed.
        </p>
      </Card>

      {/* Boundary: Vektrum vs external process */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={18} className="text-vektrum-blue" aria-hidden={true} />
            <h4 className="text-[13px] font-bold uppercase tracking-wide text-vektrum-text">Vektrum</h4>
          </div>
          <ul className="space-y-1.5 text-[13px] text-vektrum-muted">
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>Lender authorization recorded</li>
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>Gate result recorded</li>
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
            <li className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>Receives an authorization reference through a future approved workflow</li>
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
            Vektrum records what the lender authorized, which policy requirements passed, who authorized the release,
            and the confirmation reference returned by the external process.
          </p>
        </Card>
      )}
    </div>
  );
}
