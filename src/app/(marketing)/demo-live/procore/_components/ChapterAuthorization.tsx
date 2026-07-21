/**
 * Chapter Three — Release authorization.
 * Deterministic gate passed → an authorized funder explicitly records authorization.
 * Vektrum executes no payment.
 */
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Card, Eyebrow, KV, StatusBadge } from './primitives';
import { funder } from '../_lib/fixtures';

function BeforeAfter() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface-alt p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-vektrum-faint">Before</p>
        <ul className="space-y-1.5 text-[13px] text-vektrum-muted">
          <li>2 policy exceptions</li>
          <li>Critical risk</li>
          <li>Authorization unavailable</li>
        </ul>
      </div>
      <div className="rounded-2xl border border-vektrum-green-border bg-vektrum-green-bg p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-vektrum-green">After</p>
        <ul className="space-y-1.5 text-[13px] text-vektrum-text">
          <li>0 unresolved policy exceptions</li>
          <li>Low risk</li>
          <li>Ready for funder authorization</li>
        </ul>
      </div>
    </div>
  );
}

export function ChapterAuthorization({ onOpenAuthorize }: { onOpenAuthorize: () => void }) {
  return (
    <div className="space-y-5">
      <BeforeAfter />

      <Card className="border-vektrum-green-border bg-vektrum-green-bg">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-vektrum-green" aria-hidden={true} />
          <h3 className="text-[18px] font-bold tracking-tight text-vektrum-text">Ready for funder authorization</h3>
        </div>
        <p className="mt-1 max-w-3xl text-[14px] text-vektrum-muted">
          All applicable lender-policy requirements passed. Vektrum has not executed a payment. An authorized funder
          must explicitly record the release authorization.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KV k="Applicable conditions passed" v="9" />
          <KV k="Not applicable" v="1 (external rail)" />
          <KV k="AI-assisted pre-review" v="Current" />
          <KV k="Deterministic gate result" v={<StatusBadge status="passed" />} />
          <KV k="Payment execution" v="Not initiated by Vektrum" />
          <KV k="Acting funder" v={`${funder.name}`} />
        </div>
      </Card>

      <Card>
        <Eyebrow>Authorization authority</Eyebrow>
        <ul className="grid gap-2 text-[13px] text-vektrum-muted sm:grid-cols-2">
          <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-vektrum-blue" aria-hidden={true} />The gate result is deterministic; the AI output is supporting information.</li>
          <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-vektrum-blue" aria-hidden={true} />{funder.name} is acting as the authorized funder.</li>
          <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-vektrum-blue" aria-hidden={true} />Contractors cannot authorize; administrators cannot authorize on the funder&rsquo;s behalf.</li>
          <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-vektrum-blue" aria-hidden={true} />External partners cannot create or bypass authorization.</li>
        </ul>
        <div className="mt-5 flex justify-center">
          <button
            type="button" onClick={onOpenAuthorize}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-vektrum-blue px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-vektrum-blue-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
          >
            Authorize release <ArrowRight size={16} aria-hidden={true} />
          </button>
        </div>
      </Card>
    </div>
  );
}
