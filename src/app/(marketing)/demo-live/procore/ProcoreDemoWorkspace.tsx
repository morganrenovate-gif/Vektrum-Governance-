'use client';
/**
 * Procore × Vektrum partnership prototype — client orchestrator.
 *
 * SIMULATED INTEGRATION CONCEPT — fictional demo data only. No external system
 * is connected and no funds are moved. Holds the pure reducer, routes the
 * scenes of the ~90-second walkthrough, manages focus + screen-reader
 * announcements, and offers a deterministic reset. Imports NO production logic.
 */
import { useReducer, useState, useRef, useEffect, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { reducer, makeInitialContext } from './_lib/machine';
import { DISCLOSURE, FICTION_LABEL } from './_lib/fixtures';
import type { DemoContext, SourceRecordKey } from './_lib/types';
import { ProgressNavigator } from './_components/ProgressNavigator';
import { SceneWorkspace } from './_components/SceneWorkspace';
import { SceneReview } from './_components/SceneReview';
import { SceneDecision } from './_components/SceneDecision';
import { AuthorizeModal } from './_components/AuthorizeModal';

function stepOf(ctx: DemoContext): number {
  if (ctx.state === 'workspace') return 1;
  if (ctx.state === 'review_blocked') {
    return ctx.changeOrderStatus === 'approved' || ctx.lienWaiverStatus === 'approved' ? 3 : 2;
  }
  if (ctx.state === 'gate_ready' || ctx.state === 'authorization_modal_open') return 4;
  return 5;
}

const ANNOUNCE: Record<DemoContext['state'], string> = {
  workspace: 'Demo reset to the initial state. Simulated project workspace shown.',
  review_blocked: 'Lender-policy evaluation complete. $160,000 requires resolution. Authorization unavailable.',
  gate_ready: 'All applicable conditions satisfied. Condition 4 remains not applicable for the external rail. Ready for explicit funder authorization.',
  authorization_modal_open: 'Authorization dialog opened.',
  authorization_recorded: 'Release authorization recorded. No payment executed by Vektrum.',
  external_confirmation_recorded: 'Simulated external confirmation recorded. Authorization and execution remain separate states.',
};

export function ProcoreDemoWorkspace() {
  const [ctx, dispatch] = useReducer(reducer, undefined, makeInitialContext);
  const [evaluating, setEvaluating] = useState(false);
  const [reevaluating, setReevaluating] = useState<SourceRecordKey | null>(null);
  const [live, setLive] = useState('');
  const step = stepOf(ctx);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const prefersReduced = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const prevStep = useRef(step);
  useEffect(() => {
    setLive(ANNOUNCE[ctx.state]);
    if (prevStep.current !== step && ctx.state !== 'authorization_modal_open') {
      headingRef.current?.focus();
    }
    prevStep.current = step;
  }, [ctx.state, step]);

  const onEvaluate = useCallback(() => {
    setEvaluating(true);
    window.setTimeout(() => {
      setEvaluating(false);
      dispatch({ type: 'EVALUATE' });
    }, prefersReduced() ? 0 : 900);
  }, []);

  const onResolve = useCallback((record: SourceRecordKey) => {
    setReevaluating(record);
    window.setTimeout(() => {
      setReevaluating(null);
      dispatch({ type: 'RESOLVE_SOURCE_RECORD', record });
    }, prefersReduced() ? 0 : 650);
  }, []);

  const onReset = useCallback(() => {
    setEvaluating(false);
    setReevaluating(null);
    dispatch({ type: 'RESET' });
  }, []);

  return (
    <div className="min-h-screen bg-vektrum-bg">
      <div aria-live="polite" className="sr-only">{live}</div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Persistent, unobtrusive prototype disclosure */}
        <div role="note" className="mb-4 rounded-xl border border-vektrum-border bg-vektrum-surface-alt px-4 py-2">
          <p className="text-[12px] font-medium text-vektrum-muted">{DISCLOSURE}</p>
          <p className="text-[11px] text-vektrum-faint">{FICTION_LABEL}</p>
        </div>

        {/* Header row */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-vektrum-blue">
              Integration concept · Simulated
            </p>
            <h1
              ref={headingRef} tabIndex={-1}
              className="text-[22px] font-bold tracking-tight text-vektrum-text outline-none"
            >
              Construction-loan disbursement authorization
            </h1>
          </div>
          <button
            type="button" onClick={onReset}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-vektrum-border bg-vektrum-surface px-4 py-2.5 text-[13px] font-semibold text-vektrum-text hover:bg-vektrum-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-vektrum-blue"
          >
            <RotateCcw size={15} aria-hidden={true} /> Reset demo
          </button>
        </div>

        <ProgressNavigator step={step} />

        <div className="mt-5">
          {ctx.state === 'workspace' && (
            <SceneWorkspace evaluating={evaluating} onEvaluate={onEvaluate} />
          )}

          {(ctx.state === 'review_blocked' || ctx.state === 'gate_ready'
            || ctx.state === 'authorization_modal_open') && (
            <SceneReview
              ctx={ctx}
              reevaluating={reevaluating}
              onResolve={onResolve}
              onOpenAuthorize={() => dispatch({ type: 'OPEN_AUTHORIZATION' })}
            />
          )}

          {(ctx.state === 'authorization_recorded' || ctx.state === 'external_confirmation_recorded') && (
            <SceneDecision
              ctx={ctx}
              onConfirm={() => dispatch({ type: 'RECORD_EXTERNAL_CONFIRMATION' })}
            />
          )}
        </div>
      </div>

      {ctx.state === 'authorization_modal_open' && (
        <AuthorizeModal
          onClose={() => dispatch({ type: 'CLOSE_AUTHORIZATION' })}
          onConfirm={() => dispatch({ type: 'RECORD_AUTHORIZATION', actor: 'funder' })}
        />
      )}
    </div>
  );
}
