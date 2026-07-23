/**
 * Audit evidence timeline (+ collapsed technical-evidence concept) and the
 * "Better together" partnership-value panel.
 */
import { Card, Eyebrow, InertRef } from './primitives';
import { buildAuditEvents } from '../_lib/machine';
import type { DemoContext } from '../_lib/types';

export function AuditTimeline({ ctx }: { ctx: DemoContext }) {
  const events = buildAuditEvents(ctx);
  if (events.length === 0) return null;
  return (
    <Card>
      <Eyebrow>Tamper-evident authorization evidence</Eyebrow>
      <ol className="space-y-3">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-vektrum-blue-subtle text-[11px] font-bold text-vektrum-blue">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-vektrum-text">{e.eventType}</p>
              <p className="text-[12.5px] text-vektrum-muted">{e.explanation}</p>
              <p className="mt-0.5 text-[11.5px] text-vektrum-faint">
                {e.actor} · {e.timestamp} · {e.source} · <InertRef>{e.reference}</InertRef>
              </p>
            </div>
          </li>
        ))}
      </ol>

      <details className="mt-4 rounded-xl border border-vektrum-border-subtle">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-[13px] font-semibold text-vektrum-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-vektrum-blue">
          Technical evidence concept
        </summary>
        <div className="grid gap-2 px-4 pb-4 text-[12.5px] text-vektrum-muted sm:grid-cols-2">
          <p>Authorization references: <InertRef>DEMO-AUTH-HPMC-07A</InertRef> / <InertRef>DEMO-AUTH-HPMC-07B</InertRef> <span className="text-vektrum-faint">(Simulated)</span></p>
          <p>Evidence snapshot reference: <InertRef>DEMO-SNAP-HPMC-07-2</InertRef> <span className="text-vektrum-faint">(Simulated)</span></p>
          <p>Audit-chain reference: <InertRef>MOCK-CHAIN-HPMC-07</InertRef> <span className="text-vektrum-faint">(Simulated)</span></p>
          <p>External acknowledgement reference: <InertRef>DEMO-MWTE-88241</InertRef> <span className="text-vektrum-faint">(Simulated)</span></p>
          <p className="sm:col-span-2 text-vektrum-faint">All values are inert placeholders. No raw tokens, hashes, cryptographic material, request bodies, signatures, or headers are shown.</p>
        </div>
      </details>
    </Card>
  );
}

const BENEFITS = [
  { head: 'For Procore customers', body: 'Reduce the need to reassemble project records for separate lender-review workflows.' },
  { head: 'For capital providers', body: 'Apply consistent construction-loan release requirements using current project evidence.' },
  { head: 'For project teams', body: 'Keep construction and financial records in the established Procore workflow.' },
  { head: 'For execution partners', body: 'Retain existing title, escrow, treasury, banking, or fund-control infrastructure.' },
];

const WHY = [
  'Extends the downstream value of Procore-managed project information',
  'Preserves Procore as the project system of record',
  'Supports an additional external stakeholder: the construction capital provider',
  'Reduces pressure for customers to manage lender review entirely through spreadsheets, email, and disconnected document packages',
  'Creates a potential integration and Marketplace use case subject to technical and commercial validation',
];

export function BetterTogether() {
  return (
    <div className="rounded-2xl border border-white/10 bg-vektrum-canvas p-5 text-white shadow-sm">
      <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300">Better together</p>
      <h3 className="text-[19px] font-bold tracking-tight text-white">
        Procore manages the project. Vektrum applies the lender&rsquo;s release policy.
      </h3>
      <p className="mt-2 max-w-4xl text-[13.5px] text-white/70">
        Project teams continue managing construction financials, invoices, commitments, change orders, and supporting
        documentation in Procore. Vektrum uses a governed snapshot of the relevant records to support an external
        capital provider&rsquo;s construction-loan disbursement authorization process.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((b) => (
          <div key={b.head} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-300">{b.head}</p>
            <p className="mt-1.5 text-[13px] text-white/80">{b.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-blue-300">Why this could matter to Procore</p>
        <ul className="grid gap-1.5 text-[13px] text-white/75 sm:grid-cols-2">
          {WHY.map((w) => <li key={w} className="flex gap-2"><span className="text-blue-300" aria-hidden={true}>•</span>{w}</li>)}
        </ul>
      </div>
    </div>
  );
}
