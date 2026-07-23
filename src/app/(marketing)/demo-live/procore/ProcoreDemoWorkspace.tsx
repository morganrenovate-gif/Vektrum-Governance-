'use client';
/**
 * Procore × Vektrum partnership prototype — client orchestrator.
 *
 * SIMULATED INTEGRATION CONCEPT — fictional demo data only. No external system
 * is connected and no funds are moved. Holds the pure reducer, routes the four
 * executive chapters of the MILESTONE-ISOLATION walkthrough, manages focus +
 * screen-reader announcements, and offers a deterministic reset. The only
 * production code reached (transitively, via the machine) is the pure
 * reconciliation engine src/lib/engine/release-units.ts.
 */
import { useReducer, useState, useRef, useEffect, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { reducer, makeInitialContext, currentAuthRound, authorizationScope } from './_lib/machine';
import { DISCLOSURE, FICTION_LABEL } from './_lib/fixtures';
import type { DemoContext } from './_lib/types';
import { ProgressNavigator } from './_components/ProgressNavigator';
import { ChapterProjectRecords } from './_components/ChapterProjectRecords';
import { ChapterLenderReview } from './_components/ChapterLenderReview';
import { ChapterAuthorization } from './_components/ChapterAuthorization';
import { ChapterExecutionEvidence } from './_components/ChapterExecutionEvidence';
import { AuthorizeModal } from './_components/AuthorizeModal';
import { AuditTimeline, BetterTogether } from './_components/AuditAndValue';

const CHAPTER_OF: Record<DemoContext['state'], number> = {
  snapshot_available: 1, snapshot_imported: 1,
  review_isolated: 2, authorize_eligible_open: 2,
  eligible_authorized: 3, source_updates_staged: 3, isolated_resolved: 3, authorize_resolved_open: 3,
  resolved_authorized: 4, external_confirmation_recorded: 4,
};
const CHAPTER_TITLE: Record<number, string> = {
  1: 'Chapter 1 — Project records & release units',
  2: 'Chapter 2 — Isolate the exception, authorize eligible work',
  3: 'Chapter 3 — Resolve & re-authorize the contained unit',
  4: 'Chapter 4 — Execution evidence & audit',
};
const ANNOUNCE: Record<DemoContext['state'], string> = {
  snapshot_available: 'Demo reset to the initial state.',
  snapshot_imported: 'Project snapshot imported. Draw broken into four release units. Procore remains the system of record.',
  review_isolated: 'Pre-review complete. Two exceptions contained to one $310,000 unit. Three units remain eligible.',
  authorize_eligible_open: 'Authorization dialog opened for the eligible units. Isolated unit excluded.',
  eligible_authorized: 'Eligible units authorized for $1,776,500 net. Isolated unit still contained.',
  source_updates_staged: 'Both simulated source corrections staged for the contained unit.',
  isolated_resolved: 'Updated snapshot received. Contained unit re-evaluated to eligible.',
  authorize_resolved_open: 'Authorization dialog opened for the resolved unit.',
  resolved_authorized: 'Resolved unit authorized for $294,500 net in a separate record.',
  external_confirmation_recorded: 'Simulated external confirmation recorded.',
};

export function ProcoreDemoWorkspace() {
  const [ctx, dispatch] = useReducer(reducer, undefined, makeInitialContext);
  const [importing, setImporting] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [live, setLive] = useState('');
  const chapter = CHAPTER_OF[ctx.state];
  const headingRef = useRef<HTMLHeadingElement>(null);

  const prevChapter = useRef(chapter);
  useEffect(() => {
    setLive(ANNOUNCE[ctx.state]);
    const modalOpen = ctx.state === 'authorize_eligible_open' || ctx.state === 'authorize_resolved_open';
    if (prevChapter.current !== chapter && !modalOpen) {
      headingRef.current?.focus();
    }
    prevChapter.current = chapter;
  }, [ctx.state, chapter]);

  const onImport = useCallback(() => {
    setImporting(true);
    const prefersReduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => { setImporting(false); dispatch({ type: 'IMPORT_SNAPSHOT' }); },
      prefersReduced ? 0 : 700);
  }, []);
  const onReset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const modalOpen = ctx.state === 'authorize_eligible_open' || ctx.state === 'authorize_resolved_open';
  const round = currentAuthRound(ctx);
  const scope = modalOpen ? authorizationScope(ctx) : null;

  return (
    <div className="min-h-screen bg-vektrum-bg">
      <div aria-live="polite" className="sr-only">{live}</div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Prototype disclosure — prominent */}
        <div role="note" className="mb-4 rounded-2xl border border-vektrum-amber-border bg-vektrum-amber-bg px-4 py-3">
          <p className="text-[13px] font-semibold text-vektrum-amber">{DISCLOSURE}</p>
          <p className="mt-0.5 text-[12px] text-vektrum-muted">{FICTION_LABEL}</p>
        </div>

        {/* Header row */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-vektrum-blue">
              Proposed integration workflow · Simulated
            </p>
            <h1 className="text-[22px] font-bold tracking-tight text-vektrum-text">
              Block the disputed milestone — not the entire draw
            </h1>
          </div>
          <button
            type="button" onClick={onReset}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-vektrum-border bg-vektrum-surface px-4 py-2.5 text-[13px] font-semibold text-vektrum-text hover:bg-vektrum-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-vektrum-blue"
          >
            <RotateCcw size={15} aria-hidden={true} /> Reset demo
          </button>
        </div>

        <ProgressNavigator chapter={chapter} showGuide={showGuide} onToggleGuide={() => setShowGuide((v) => !v)} />

        <section aria-label={CHAPTER_TITLE[chapter]} className="mt-5">
          <h2 ref={headingRef} tabIndex={-1} className="mb-3 text-[15px] font-bold uppercase tracking-wide text-vektrum-muted outline-none">
            {CHAPTER_TITLE[chapter]}
          </h2>

          {chapter === 1 && (
            <ChapterProjectRecords
              ctx={ctx} importing={importing} onImport={onImport}
              onRunPreReview={() => dispatch({ type: 'RUN_PRE_REVIEW' })}
            />
          )}
          {chapter === 2 && (
            <ChapterLenderReview
              ctx={ctx}
              onOpenAuthorizeEligible={() => dispatch({ type: 'OPEN_AUTHORIZATION', round: 'eligible' })}
            />
          )}
          {chapter === 3 && (
            <ChapterAuthorization
              ctx={ctx}
              onStage={(u) => dispatch({ type: 'STAGE_SOURCE_UPDATE', update: u })}
              onReceive={() => dispatch({ type: 'RECEIVE_UPDATED_SNAPSHOT' })}
              onOpenAuthorizeResolved={() => dispatch({ type: 'OPEN_AUTHORIZATION', round: 'resolved' })}
            />
          )}
          {chapter === 4 && (
            <ChapterExecutionEvidence ctx={ctx} onConfirm={() => dispatch({ type: 'RECORD_EXTERNAL_CONFIRMATION' })} />
          )}
        </section>

        {/* Audit evidence (grows with progress) */}
        {ctx.state !== 'snapshot_available' && (
          <div className="mt-6">
            <AuditTimeline ctx={ctx} />
          </div>
        )}

        {/* Strategic close */}
        <div className="mt-6">
          <BetterTogether />
        </div>
      </div>

      {modalOpen && round && scope && (
        <AuthorizeModal
          round={round}
          netAmount={scope.netAmount}
          includedUnitIds={scope.unitIds}
          excludedUnitIds={scope.excludedIsolatedUnitIds}
          onClose={() => dispatch({ type: 'CLOSE_AUTHORIZATION' })}
          onConfirm={() => dispatch({ type: 'RECORD_AUTHORIZATION' })}
        />
      )}
    </div>
  );
}
