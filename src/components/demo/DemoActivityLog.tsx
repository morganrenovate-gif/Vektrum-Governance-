'use client'

/**
 * DemoActivityLog
 *
 * Client-side-only activity log shown on demo-live pages.
 *
 * Displays entries added by useDemoActivityLog() as the viewer interacts
 * with the demo. Demonstrates the audit-trail concept without writing to
 * the production audit_log table or calling any real API route.
 *
 * Safe copy guarantees:
 *  - Uses "append-only" and "tamper-evident" framing only when describing
 *    the real production audit model (not used for this demo component).
 *  - This component's own disclaimer says "client-side demo only" explicitly.
 *  - Does NOT make tamper-evident or immutability claims about this log.
 */

import { ScrollText } from 'lucide-react'
import type { DemoActivityEntry } from '@/lib/demo-data/use-demo-activity-log'

// ── Badge helpers ─────────────────────────────────────────────────────────────

function roleBadgeClass(role: DemoActivityEntry['role']): string {
  switch (role) {
    case 'funder':     return 'bg-vektrum-blue/20 text-blue-300'
    case 'contractor': return 'bg-amber-500/[0.12] text-amber-400'
    case 'admin':      return 'bg-purple-500/[0.12] text-purple-400'
    case 'system':
    default:           return 'bg-white/[0.06] text-white/45'
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DemoActivityLogProps {
  entries: DemoActivityEntry[]
}

export function DemoActivityLog({ entries }: DemoActivityLogProps) {
  return (
    <section aria-label="Demo Activity Log">
      {/* Section heading */}
      <div className="flex items-center gap-2 mb-3">
        <ScrollText size={14} className="text-white/40" aria-hidden="true" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">
          Demo Activity Log
        </h2>
        {entries.length > 0 && (
          <span className="ml-0.5 inline-flex items-center rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-semibold text-white/40">
            {entries.length}
          </span>
        )}
      </div>

      {/* Disclaimer — must be visible and truthful */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 mb-3">
        <p className="text-[11px] text-white/40 leading-relaxed">
          <span className="font-semibold text-white/55">Client-side demo only</span>
          {' '}— no production audit log written. Entries appear here as you interact
          with this demo session. Real Vektrum deployments write to an append-only,
          hash-chained audit log stored in Supabase.
        </p>
      </div>

      {/* Log entries */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-surface-2 px-4 py-6 text-center">
          <p className="text-[12px] text-white/30 italic">
            No activity yet — perform an action above to see it logged here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden">
          <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.04]">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                {/* Timestamp */}
                <span className="font-mono text-[10px] text-white/25 tabular-nums pt-0.5 flex-shrink-0 w-[72px] text-right">
                  {entry.timestamp}
                </span>

                {/* Entry body */}
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-white/65 flex-shrink-0">
                    {entry.actor}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide flex-shrink-0 ${roleBadgeClass(entry.role)}`}
                  >
                    {entry.role}
                  </span>
                  <span className="text-[11px] font-semibold text-white/80 flex-shrink-0">
                    {entry.action}
                  </span>
                  {entry.detail && (
                    <span className="text-[11px] text-white/40 break-words">
                      · {entry.detail}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
