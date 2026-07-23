/**
 * Chapter One — Project records.
 * Procore remains the system of record; Vektrum imports a governed read-only snapshot.
 */
import { Download, ArrowRight, Building2, ShieldCheck, Landmark } from 'lucide-react';
import { Card, Eyebrow, KV, StatusBadge, money, InertRef } from './primitives';
import { ReleaseUnitsTable } from './ReleaseUnits';
import { releaseUnitViews } from '../_lib/machine';
import {
  project, draw, snapshot, lenderPolicy, changeOrder, lienWaiver,
  conceptualMappings, MAPPING_CAVEAT,
} from '../_lib/fixtures';
import type { DemoContext } from '../_lib/types';

const COLUMNS = [
  { Icon: Building2, head: 'Procore — project system of record', items: [
    'Project financials', 'Funding/owner invoice', 'Commitments', 'Change orders',
    'Schedule of values', 'Project documents', 'Supporting evidence'] },
  { Icon: ShieldCheck, head: 'Vektrum — lender policy layer', items: [
    'Normalizes the draw-review snapshot', 'Applies lender-specific release requirements',
    'Produces an AI-assisted pre-review', 'Evaluates the deterministic 10-condition release gate',
    "Records the funder's authorization and evidence"] },
  { Icon: Landmark, head: 'External process — capital and execution', items: [
    'Lender controls the construction facility',
    'Title, escrow, treasury, banking, or fund-control process executes',
    'External partner returns confirmation evidence'] },
];

export function ChapterProjectRecords({
  ctx, importing, onImport, onRunPreReview,
}: {
  ctx: DemoContext; importing: boolean;
  onImport: () => void; onRunPreReview: () => void;
}) {
  const imported = ctx.state !== 'snapshot_available';
  return (
    <div className="space-y-5">
      {/* Integration-concept header */}
      <Card>
        <Eyebrow>Procore integration concept</Eyebrow>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <KV k="Status" v={<StatusBadge status="simulated" />} />
          <KV k="Source mode" v="Read-only project snapshot" />
          <KV k="Project" v={project.name} />
          <KV k="Snapshot timestamp" v={ctx.snapshotTimestamp} />
          <KV k="Destination" v="Vektrum lender-governance workspace" />
        </div>
      </Card>

      {/* Keep the workflow in Procore */}
      <Card className="bg-vektrum-blue-subtle">
        <h3 className="text-[18px] font-bold tracking-tight text-vektrum-blue">Keep the project workflow in Procore.</h3>
        <p className="mt-1 max-w-3xl text-[14px] text-vektrum-muted">
          Vektrum does not recreate the project record. This concept uses a governed snapshot of selected project
          information for external lender review.
        </p>
      </Card>

      {/* Responsibility boundary — three columns */}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map(({ Icon, head, items }) => (
          <Card key={head}>
            <div className="mb-3 flex items-center gap-2">
              <Icon size={18} className="text-vektrum-blue" aria-hidden={true} />
              <h4 className="text-[13px] font-bold uppercase tracking-wide text-vektrum-text">{head}</h4>
            </div>
            <ul className="space-y-1.5 text-[13px] text-vektrum-muted">
              {items.map((it) => <li key={it} className="flex gap-2"><span className="text-vektrum-faint" aria-hidden={true}>•</span>{it}</li>)}
            </ul>
          </Card>
        ))}
      </div>

      {/* Import action */}
      {!imported ? (
        <div className="flex justify-center">
          <button
            type="button" onClick={onImport} disabled={importing}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-vektrum-blue px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-vektrum-blue-hover disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
          >
            <Download size={16} aria-hidden={true} />
            {importing ? 'Importing simulated snapshot…' : 'Import simulated project snapshot'}
          </button>
        </div>
      ) : (
        <>
          {/* Post-import summary */}
          <Card>
            <Eyebrow>Governed project snapshot</Eyebrow>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <KV k="Project" v={`${project.name} · ${project.projectNumber}`} />
              <KV k="Draw" v={draw.drawNumber} />
              <KV k="Billing period" v={draw.billingPeriod} />
              <KV k="Gross requested" v={money(draw.grossRequested)} />
              <KV k="Retainage" v={money(draw.retainage)} />
              <KV k="Net represented" v={money(draw.netRepresented)} />
              <KV k="Snapshot timestamp" v={ctx.snapshotTimestamp} />
              <KV k="Source" v={<StatusBadge status="simulated" labelOverride="Procore-originated — simulated" />} />
            </div>
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-vektrum-faint">Included record categories</p>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.includedRecordCategories.map((c) => (
                  <span key={c} className="rounded-full bg-vektrum-surface-alt px-2.5 py-1 text-[11px] text-vektrum-muted">{c}</span>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[13px] text-vektrum-muted">
              <span className="font-semibold text-vektrum-text">Procore remains the source of the project records.</span>{' '}
              Vektrum references a point-in-time governed snapshot for external lender review.
            </p>
          </Card>

          {/* The draw as four independently-governable release units */}
          <ReleaseUnitsTable units={releaseUnitViews(ctx)} />
          <p className="-mt-2 px-1 text-[12px] text-vektrum-muted">
            Each schedule-of-values line becomes an independently-governable release unit. If one unit fails a policy
            condition or enters a dispute, only that unit is contained — the rest continue to authorization.
          </p>

          {/* Conceptual field mapping (collapsed) */}
          <details className="rounded-2xl border border-vektrum-border bg-vektrum-surface">
            <summary className="cursor-pointer list-none px-5 py-4 text-[14px] font-semibold text-vektrum-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-vektrum-blue">
              Conceptual field mapping
              <span className="ml-2 font-normal text-vektrum-faint">— {MAPPING_CAVEAT}</span>
            </summary>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-vektrum-faint">
                    <th className="py-1.5 pr-4 font-medium">Procore source (conceptual)</th>
                    <th className="py-1.5 pr-4 font-medium">Vektrum destination</th>
                    <th className="py-1.5 font-medium">Prototype status</th>
                  </tr>
                </thead>
                <tbody className="text-vektrum-muted">
                  {conceptualMappings.map((m) => (
                    <tr key={m.sourceConcept} className="border-t border-vektrum-border-subtle">
                      <td className="py-1.5 pr-4">{m.sourceConcept}</td>
                      <td className="py-1.5 pr-4">{m.destinationConcept}</td>
                      <td className="py-1.5"><StatusBadge status="simulated" labelOverride="Conceptual" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[12px] text-vektrum-faint">
                API access and required permissions are not yet validated. Not production-ready; not a real-time feed;
                no Procore approval implied.
              </p>
            </div>
          </details>

          {/* Lender policy profile */}
          <Card className="border-vektrum-blue-border">
            <Eyebrow>Lender release policy</Eyebrow>
            <h4 className="text-[15px] font-bold text-vektrum-text">{lenderPolicy.name}</h4>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <KV k="Policy ID" v={<InertRef>{lenderPolicy.policyId}</InertRef>} />
              <KV k="Policy owner" v={lenderPolicy.owner} />
              <KV k="Applies to" v={lenderPolicy.appliesTo} />
              <KV k="Evaluation mode" v={lenderPolicy.evaluationMode} />
              <KV k="Execution rail" v={lenderPolicy.executionRail} />
              <KV k="Last mock revision" v={lenderPolicy.lastRevision} />
            </div>
            <p className="mt-3 text-[13px] text-vektrum-muted">
              Release requirements are established by the capital provider. Vektrum evaluates the governed project
              snapshot against the selected policy.
            </p>
          </Card>

          {/* Initial exceptions */}
          <Card>
            <Eyebrow>Lender-policy exceptions</Eyebrow>
            <p className="mb-3 text-[13px] text-vektrum-muted">
              The snapshot contains two records that do not currently satisfy the selected lender policy.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-vektrum-border bg-vektrum-surface-alt p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-vektrum-text">Conditional lien waiver</span>
                  <StatusBadge status="warning" labelOverride="Draft / not approved" />
                </div>
                <p className="text-[12px] text-vektrum-muted">{lienWaiver.source}</p>
              </div>
              <div className="rounded-xl border border-vektrum-border bg-vektrum-surface-alt p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-vektrum-text">Change Order {changeOrder.id}</span>
                  <StatusBadge status="warning" labelOverride="Open · affects milestone" />
                </div>
                <p className="text-[12px] text-vektrum-muted">{changeOrder.source}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-center">
              <button
                type="button" onClick={onRunPreReview}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-vektrum-blue px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-vektrum-blue-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
              >
                Run lender-policy pre-review <ArrowRight size={16} aria-hidden={true} />
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
