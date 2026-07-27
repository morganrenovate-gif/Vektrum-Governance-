/**
 * Scene 1 — Simulated project workspace.
 *
 * An original construction-project workspace view (not a Procore counterfeit).
 * The draw plausibly appears package-complete; CO-027 is deliberately not
 * foregrounded here — the evaluation reveals it. One primary action.
 */
import { Building2, FileCheck2, ArrowRight, Loader2 } from 'lucide-react';
import { Card, Eyebrow, KV, StatusBadge, money, InertRef } from './primitives';
import { project, draw, evidence, WORKSPACE_SUPPORT_LINE } from '../_lib/fixtures';

export function SceneWorkspace({
  evaluating, onEvaluate,
}: { evaluating: boolean; onEvaluate: () => void }) {
  return (
    <div className="space-y-4">
      {/* Project header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-vektrum-blue-subtle text-vektrum-blue">
              <Building2 size={22} aria-hidden={true} />
            </span>
            <div>
              <Eyebrow>Simulated project workspace</Eyebrow>
              <h2 className="text-[19px] font-bold tracking-tight text-vektrum-text">{project.name}</h2>
              <p className="text-[13px] text-vektrum-muted">
                <InertRef>{project.projectNumber}</InertRef> · {project.location} · {project.type}
              </p>
            </div>
          </div>
          <StatusBadge status="simulated" labelOverride="Fictional project" />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KV k="General contractor" v={project.generalContractor} />
          <KV k="Owner" v={project.owner} />
          <KV k="Lender" v={project.lender} />
          <KV k="Execution partner" v={project.disbursementPartner} />
          <KV k="Contract value" v={money(project.totalProjectValue)} />
          <KV k="Lending facility" v={money(project.constructionFacility)} />
        </dl>
      </Card>

      {/* Draw package — appears complete */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>{draw.drawNumber}</Eyebrow>
            <p className="text-[28px] font-bold tracking-tight text-vektrum-text">{money(draw.grossRequested)}</p>
            <p className="text-[13px] text-vektrum-muted">
              Gross requested · {draw.billingPeriod} · {draw.milestone} ({draw.reportedCompletionPct}% reported)
            </p>
            <p className="mt-1 text-[13px] text-vektrum-muted">
              Retainage {money(draw.retainage)} · Net requested {money(draw.netRepresented)} · Rail: {draw.executionRail}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-vektrum-green-border bg-vektrum-green-bg px-3 py-1.5 text-[12px] font-semibold text-vektrum-green">
              <FileCheck2 size={14} aria-hidden={true} /> Package status: Complete
            </span>
            <p className="text-[11px] text-vektrum-faint">{evidence.length} source-record categories attached</p>
          </div>
        </div>

        {/* Source-record categories */}
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Source-record categories">
          {evidence.map((e) => (
            <li key={e.id} className="rounded-full border border-vektrum-border bg-vektrum-surface-alt px-3 py-1 text-[12px] text-vektrum-muted">
              {e.category}
            </li>
          ))}
        </ul>

        {/* Single primary action */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-vektrum-border pt-4">
          <p className="max-w-xl text-[13px] text-vektrum-muted">{WORKSPACE_SUPPORT_LINE}</p>
          <button
            type="button" onClick={onEvaluate} disabled={evaluating}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-vektrum-blue px-6 py-3 text-[14px] font-bold text-white hover:bg-vektrum-blue-hover disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
          >
            {evaluating
              ? (<><Loader2 size={16} className="animate-spin" aria-hidden={true} /> Evaluating (simulated)…</>)
              : (<>Evaluate against lender policy <ArrowRight size={16} aria-hidden={true} /></>)}
          </button>
        </div>
      </Card>
    </div>
  );
}
