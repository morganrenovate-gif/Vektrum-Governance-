'use client';
/**
 * Procore × Vektrum partnership prototype — client orchestrator.
 *
 * SIMULATED INTEGRATION CONCEPT — fictional demo data only. No external system
 * is connected and no funds are moved. Holds the pure reducer, routes the four
 * executive chapters, manages focus + screen-reader announcements, and offers a
 * deterministic reset. Imports NO production logic.
 */
import { useReducer, useState, useRef, useEffect, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { reducer, makeInitialContext } from './_lib/machine';
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
  review_blocked: 2, source_updates_staged: 2, updated_snapshot_received: 2,
  gate_ready: 3, authorization_modal_open: 3,
  authorization_recorded: 4, external_confirmation_recorded: 4,
};
const CHAPTER_TITLE: Record<number, string> = {
  1: 'Chapter 1 — Project records', 2: 'Chapter 2 — Lender review',
  3: 'Chapter 3 — Release authorization', 4: 'Chapter 4 — Execution evidence',
};
const ANNOUNCE: Record<DemoContext['state'], string> = {
  snapshot_available: 'Demo reset to the initial state.',
  snapshot_imported: 'Project snapshot imported. Procore remains the system of record.',
  review_blocked: 'Lender-policy pre-review complete. Two policy exceptions identified. Authorization unavailable.',
  source_updates_staged: 'Both simulated source updates staged. You can now receive an updated snapshot.',
  updated_snapshot_received: 'Updated snapshot received.',
  gate_ready: 'Updated snapshot received. Risk is Low. All applicable conditions passed. Ready for funder authorization.',
  authorization_modal_open: 'Authorization dialog opened.',
  authorization_recorded: 'Release authorization recorded. No payment executed by Vektrum.',
  external_confirmation_recorded: 'Simulated external confirmation recorded.',
};

export function ProcoreDemoWorkspace() {
  const [ctx, dispatch] = useReducer(reducer, undefined, makeInitialContext);
  const [importing, setImporting] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [live, setLive] = useState('');
  const chapter = CHAPTER_OF[ctx.state];
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Announce + move focus to the chapter heading on chapter change.
  const prevChapter = useRef(chapter);
  useEffect(() => {
    setLive(ANNOUNCE[ctx.state]);
    if (prevChapter.current !== chapter && ctx.state !== 'authorization_modal_open') {
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
              onStage={(u) => dispatch({ type: 'STAGE_SOURCE_UPDATE', update: u })}
              onReceive={() => dispatch({ type: 'RECEIVE_UPDATED_SNAPSHOT' })}
            />
          )}
          {chapter === 3 && (
            <ChapterAuthorization onOpenAuthorize={() => dispatch({ type: 'OPEN_AUTHORIZATION' })} />
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

      {ctx.state === 'authorization_modal_open' && (
        <AuthorizeModal
          onClose={() => dispatch({ type: 'CLOSE_AUTHORIZATION' })}
          onConfirm={() => dispatch({ type: 'RECORD_AUTHORIZATION' })}
        />
      )}
    </div>
  );
}
