'use client';
/**
 * Accessible authorization confirmation modal.
 * Focus-trapped, Escape-to-close, focus restored on close. Confirm stays disabled
 * until the funder selects the required acknowledgement.
 *
 * Records LENDER RELEASE AUTHORIZATION ONLY. Vektrum executes no payment.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { KV, money, InertRef } from './primitives';
import { project, draw, lenderPolicy, funder, authorizationRecord } from '../_lib/fixtures';

export function AuthorizeModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [ack, setAck] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const focusables = useCallback(() => {
    if (!dialogRef.current) return [] as HTMLElement[];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled'));
  }, []);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement;
    const first = focusables()[0];
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [focusables, onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden={true} />
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="authz-title" aria-describedby="authz-desc"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-vektrum-border bg-vektrum-surface p-6 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="authz-title" className="text-[18px] font-bold tracking-tight text-vektrum-text">Record release authorization</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog"
            className="rounded-lg p-1 text-vektrum-muted hover:bg-vektrum-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-vektrum-blue">
            <X size={18} aria-hidden={true} />
          </button>
        </div>
        <p id="authz-desc" className="mb-4 text-[13px] text-vektrum-muted">
          This records the lender&rsquo;s release authorization for the governed draw. Vektrum executes no payment.
        </p>

        <dl className="grid grid-cols-2 gap-4">
          <KV k="Project" v={`${project.name}`} />
          <KV k="Draw" v={draw.drawNumber} />
          <KV k="Gross requested" v={money(draw.grossRequested)} />
          <KV k="Retainage" v={money(draw.retainage)} />
          <KV k="Net amount" v={money(draw.netRepresented)} />
          <KV k="Lender policy" v={<InertRef>{lenderPolicy.policyId}</InertRef>} />
          <KV k="Execution rail" v={draw.executionRail} />
          <KV k="External partner" v={project.disbursementPartner} />
          <KV k="Applicable conditions passed" v="9 of 9" />
          <KV k="Not-applicable conditions" v="1 (external rail)" />
          <KV k="Funder" v={`${funder.name} · ${funder.title}`} />
          <KV k="Authorization scope" v="Lender release authorization only" />
          <KV k="Authorization ID" v={<InertRef>{authorizationRecord.authorizationId}</InertRef>} />
          <KV k="Actor" v="Authorized funder (only role that may authorize)" />
        </dl>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-vektrum-border bg-vektrum-surface-alt p-3">
          <input
            type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-[#1A3A96]"
          />
          <span className="text-[13px] text-vektrum-text">
            I understand that this records lender release authorization only. Vektrum does not execute payment, and
            execution remains with the selected external process.
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="min-h-[44px] rounded-xl border border-vektrum-border px-4 py-2.5 text-[14px] font-semibold text-vektrum-text hover:bg-vektrum-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-vektrum-blue">
            Cancel
          </button>
          <button
            type="button" onClick={onConfirm} disabled={!ack}
            className="min-h-[44px] rounded-xl bg-vektrum-blue px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-vektrum-blue-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
          >
            Record authorization
          </button>
        </div>
      </div>
    </div>
  );
}
