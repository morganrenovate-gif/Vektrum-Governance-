/**
 * Release-unit table + draw reconciliation summary.
 *
 * The numbers rendered here come from the demo machine, which computes them with
 * the REAL, invariant-checked engine (src/lib/engine/release-units.ts). This is
 * where "block the disputed milestone — not the entire draw" becomes visible: one
 * unit is Isolated while the others stay Eligible and reconcile exactly.
 */
import { Card, Eyebrow, StatusBadge, money } from './primitives';
import type { ReleaseUnitView } from '../_lib/machine';
import type { DrawReconciliation, AuthorizationScope } from '@/lib/engine/release-units';

function unitBadge(status: ReleaseUnitView['status']) {
  if (status === 'isolated') return <StatusBadge status="blocked" labelOverride="Isolated" />;
  if (status === 'released') return <StatusBadge status="confirmed" labelOverride="Authorized" />;
  return <StatusBadge status="passed" labelOverride="Eligible" />;
}

export function ReleaseUnitsTable({ units }: { units: ReleaseUnitView[] }) {
  return (
    <Card>
      <Eyebrow>Draw #07 — schedule of values as release units</Eyebrow>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-vektrum-faint">
              <th className="py-1.5 pr-4 font-medium">SOV line</th>
              <th className="py-1.5 pr-4 font-medium">Release unit</th>
              <th className="py-1.5 pr-4 text-right font-medium">Gross</th>
              <th className="py-1.5 pr-4 text-right font-medium">Retainage</th>
              <th className="py-1.5 pr-4 text-right font-medium">Net</th>
              <th className="py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-vektrum-muted">
            {units.map((u) => (
              <tr key={u.id} className="border-t border-vektrum-border-subtle align-top">
                <td className="py-2 pr-4 font-mono text-[12px]">{u.sovLine}</td>
                <td className="py-2 pr-4">
                  <span className="font-semibold text-vektrum-text">{u.label}</span>
                  {u.status === 'isolated' && u.isolationReason && (
                    <span className="mt-0.5 block text-[12px] text-vektrum-red">{u.isolationReason}</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{money(u.grossAmount)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{money(u.retainageAmount)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{money(u.netAmount)}</td>
                <td className="py-2">{unitBadge(u.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ReconciliationSummary({
  recon, scope,
}: {
  recon: DrawReconciliation;
  scope: AuthorizationScope;
}) {
  const rows: Array<{ k: string; v: string; strong?: boolean; tone?: 'eligible' | 'isolated' }> = [
    { k: 'Draw gross (all units)', v: money(recon.drawGross) },
    { k: 'Retainage withheld', v: money(recon.retainageWithheld) },
    { k: 'Net represented', v: money(recon.drawNet) },
    { k: 'Eligible net (proceeds now)', v: money(recon.eligibleNet), strong: true, tone: 'eligible' },
    { k: 'Isolated net (contained)', v: money(recon.isolatedNet), strong: true, tone: 'isolated' },
    { k: 'Already authorized', v: money(recon.alreadyReleasedGross) },
    { k: 'Authorizable now (this scope)', v: money(scope.netAmount), strong: true, tone: 'eligible' },
  ];
  return (
    <Card>
      <Eyebrow>Draw reconciliation — computed by the release-unit engine</Eyebrow>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.k} className="flex flex-col gap-0.5">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-vektrum-faint">{r.k}</dt>
            <dd
              className={`tabular-nums ${r.strong ? 'text-[15px] font-bold' : 'text-[14px] font-semibold'} ${
                r.tone === 'isolated' ? 'text-vektrum-red' : r.tone === 'eligible' ? 'text-vektrum-green' : 'text-vektrum-text'
              }`}
            >
              {r.v}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 rounded-lg bg-vektrum-surface-alt px-3 py-2 font-mono text-[12px] text-vektrum-blue">
        eligible ${recon.eligibleGross.toLocaleString('en-US')} + isolated ${recon.isolatedGross.toLocaleString('en-US')}
        {' + '}already authorized ${recon.alreadyReleasedGross.toLocaleString('en-US')} = draw ${recon.drawGross.toLocaleString('en-US')} · reconciles exactly
      </p>
      {scope.excludedIsolatedUnitIds.length > 0 && (
        <p className="mt-2 text-[12px] text-vektrum-muted">
          Authorization scope excludes {scope.excludedIsolatedUnitIds.length} isolated unit
          {scope.excludedIsolatedUnitIds.length === 1 ? '' : 's'} — the contained amount cannot be authorized.
        </p>
      )}
    </Card>
  );
}
