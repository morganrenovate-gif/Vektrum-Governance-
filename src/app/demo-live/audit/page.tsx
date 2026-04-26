'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

type AuditCategory = 'all' | 'funds' | 'milestones' | 'disputes' | 'system'

interface AuditEvent {
  /** Unique event ID (UUID) */
  id:            string
  /** Monotonic sequence number — primary ordering key */
  event_seq:     number
  /** Exact UTC timestamp — YYYY-MM-DD HH:MM:SS UTC */
  timestamp_utc: string
  actor:         string
  actor_email:   string | null
  role:          'funder' | 'contractor' | 'admin' | 'system'
  action:        string
  category:      AuditCategory
  entity:        string
  details:       string
  /** Code module or DB trigger that generated this event */
  system_source: string
}

// ── Demo data — all timestamps exact UTC, chronologically consistent ────────
//
// Ordering guarantees for each milestone lifecycle:
//   Document Uploaded → AI Draw Review → Milestone Approved → Funds Released
//
// Reference date: 2026-04-23 (today). All entries are in the past.

const auditEvents: AuditEvent[] = [
  // ── Active / recent ──────────────────────────────────────────────────────
  {
    id:            'a1b2c3d4-0001-4000-8000-000000000001',
    event_seq:     1028,
    timestamp_utc: '2026-04-19 09:14:33 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'Dispute Opened',
    category:      'disputes',
    entity:        'milestone / HVAC Equipment Procurement',
    details:       '$487,000 disputed',
    system_source: 'api/disputes',
  },
  {
    id:            'a1b2c3d4-0002-4000-8000-000000000002',
    event_seq:     1021,
    timestamp_utc: '2026-04-15 16:42:07 UTC',
    actor:         'Diane Reyes',
    actor_email:   'dreyes@torreskimconstruction.com',
    role:          'contractor',
    action:        'Document Uploaded',
    category:      'system',
    entity:        'milestone / Structural Frame & Enclosure',
    details:       'Lien_Waiver_Reyes.pdf',
    system_source: 'api/milestones/document',
  },
  // ── Harbor: Building Envelope ─────────────────────────────────────────────
  {
    id:            'a1b2c3d4-0003-4000-8000-000000000003',
    event_seq:     1018,
    timestamp_utc: '2026-04-12 11:23:45 UTC',
    actor:         'James Okafor',
    actor_email:   'james.okafor@meridianfund.com',
    role:          'funder',
    action:        'Funds Released',
    category:      'funds',
    entity:        'milestone / Steel Frame & Envelope',
    details:       '$780,000 → Torres & Kim',
    system_source: 'api/milestones/release',
  },
  {
    id:            'a1b2c3d4-0004-4000-8000-000000000004',
    event_seq:     1012,
    timestamp_utc: '2026-04-08 10:17:22 UTC',
    actor:         'Vektrum AI',
    actor_email:   null,
    role:          'system',
    action:        'AI Draw Review',
    category:      'milestones',
    entity:        'milestone / Structural Frame & Enclosure',
    details:       'Score: 78/100 · Pass',
    system_source: 'api/ai/draw-review',
  },
  {
    id:            'a1b2c3d4-0005-4000-8000-000000000005',
    event_seq:     1009,
    timestamp_utc: '2026-04-02 14:55:09 UTC',
    actor:         'Sarah Chen',
    actor_email:   'schen@harborlogistics.com',
    role:          'funder',
    action:        'Funds Released',
    category:      'funds',
    entity:        'milestone / Building Envelope & Roofing',
    details:       '$2,640,000 → Marcus Webb',
    system_source: 'api/milestones/release',
  },
  {
    id:            'a1b2c3d4-0006-4000-8000-000000000006',
    event_seq:     1008,
    timestamp_utc: '2026-04-02 14:52:31 UTC',
    actor:         'Sarah Chen',
    actor_email:   'schen@harborlogistics.com',
    role:          'funder',
    action:        'Milestone Approved',
    category:      'milestones',
    entity:        'milestone / Building Envelope & Roofing',
    details:       'Harbor Logistics',
    system_source: 'api/milestones/status',
  },
  {
    id:            'a1b2c3d4-0007-4000-8000-000000000007',
    event_seq:     1005,
    timestamp_utc: '2026-03-30 09:38:15 UTC',
    actor:         'Vektrum AI',
    actor_email:   null,
    role:          'system',
    action:        'AI Draw Review',
    category:      'milestones',
    entity:        'milestone / Building Envelope & Roofing',
    details:       'Score: 92/100 · Pass',
    system_source: 'api/ai/draw-review',
  },
  {
    id:            'a1b2c3d4-0008-4000-8000-000000000008',
    event_seq:     1004,
    timestamp_utc: '2026-03-30 08:11:44 UTC',
    actor:         'Marcus Webb',
    actor_email:   'mwebb@webbcontracting.com',
    role:          'contractor',
    action:        'Document Uploaded',
    category:      'system',
    entity:        'milestone / Building Envelope & Roofing',
    details:       'Draw_Request_4.pdf',
    system_source: 'api/milestones/document',
  },
  // ── Harbor: Structural Steel ──────────────────────────────────────────────
  {
    id:            'a1b2c3d4-0009-4000-8000-000000000009',
    event_seq:     1001,
    timestamp_utc: '2026-03-26 15:27:03 UTC',
    actor:         'Sarah Chen',
    actor_email:   'schen@harborlogistics.com',
    role:          'funder',
    action:        'Funds Released',
    category:      'funds',
    entity:        'milestone / Structural Steel Erection',
    details:       '$2,180,000 → Marcus Webb',
    system_source: 'api/milestones/release',
  },
  {
    id:            'a1b2c3d4-0010-4000-8000-000000000010',
    event_seq:     1000,
    timestamp_utc: '2026-03-26 15:24:19 UTC',
    actor:         'Sarah Chen',
    actor_email:   'schen@harborlogistics.com',
    role:          'funder',
    action:        'Milestone Approved',
    category:      'milestones',
    entity:        'milestone / Structural Steel Erection',
    details:       'Harbor Logistics',
    system_source: 'api/milestones/status',
  },
  {
    id:            'a1b2c3d4-0011-4000-8000-000000000011',
    event_seq:     997,
    timestamp_utc: '2026-03-23 10:44:52 UTC',
    actor:         'Vektrum AI',
    actor_email:   null,
    role:          'system',
    action:        'AI Draw Review',
    category:      'milestones',
    entity:        'milestone / Structural Steel Erection',
    details:       'Score: 89/100 · Pass',
    system_source: 'api/ai/draw-review',
  },
  // ── Harbor: Concrete + Site ───────────────────────────────────────────────
  {
    id:            'a1b2c3d4-0012-4000-8000-000000000012',
    event_seq:     992,
    timestamp_utc: '2026-03-19 13:33:17 UTC',
    actor:         'Sarah Chen',
    actor_email:   'schen@harborlogistics.com',
    role:          'funder',
    action:        'Funds Released',
    category:      'funds',
    entity:        'milestone / Concrete Sub-grade & Foundations',
    details:       '$1,840,000 → Marcus Webb',
    system_source: 'api/milestones/release',
  },
  {
    id:            'a1b2c3d4-0013-4000-8000-000000000013',
    event_seq:     987,
    timestamp_utc: '2026-03-14 11:08:41 UTC',
    actor:         'Sarah Chen',
    actor_email:   'schen@harborlogistics.com',
    role:          'funder',
    action:        'Funds Released',
    category:      'funds',
    entity:        'milestone / Site Preparation & Grading',
    details:       '$320,000 → Marcus Webb',
    system_source: 'api/milestones/release',
  },
  // ── Riverside ─────────────────────────────────────────────────────────────
  {
    id:            'a1b2c3d4-0014-4000-8000-000000000014',
    event_seq:     984,
    timestamp_utc: '2026-03-12 09:55:28 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'Release Blocked',
    category:      'funds',
    entity:        'milestone / MEP Rough-In',
    details:       'AI score 58/100 — resubmit',
    system_source: 'api/milestones/release-gate',
  },
  {
    id:            'a1b2c3d4-0015-4000-8000-000000000015',
    event_seq:     981,
    timestamp_utc: '2026-03-07 14:19:05 UTC',
    actor:         'Marcus Webb',
    actor_email:   'mwebb@webbcontracting.com',
    role:          'contractor',
    action:        'Milestone Status Changed',
    category:      'milestones',
    entity:        'milestone / MEP Rough-In',
    details:       'in_progress → ready_for_review',
    system_source: 'api/milestones/status',
  },
  {
    id:            'a1b2c3d4-0016-4000-8000-000000000016',
    event_seq:     978,
    timestamp_utc: '2026-03-02 10:42:36 UTC',
    actor:         'Sarah Chen',
    actor_email:   'schen@harborlogistics.com',
    role:          'funder',
    action:        'Funds Released',
    category:      'funds',
    entity:        'milestone / Foundation & Site Prep',
    details:       '$480,000 → Marcus Webb',
    system_source: 'api/milestones/release',
  },
  {
    id:            'a1b2c3d4-0017-4000-8000-000000000017',
    event_seq:     977,
    timestamp_utc: '2026-02-28 11:37:14 UTC',
    actor:         'Sarah Chen',
    actor_email:   'schen@harborlogistics.com',
    role:          'funder',
    action:        'Milestone Approved',
    category:      'milestones',
    entity:        'milestone / Foundation & Site Prep',
    details:       'Riverside',
    system_source: 'api/milestones/status',
  },
  {
    id:            'a1b2c3d4-0018-4000-8000-000000000018',
    event_seq:     976,
    timestamp_utc: '2026-02-28 09:22:51 UTC',
    actor:         'Vektrum AI',
    actor_email:   null,
    role:          'system',
    action:        'AI Draw Review',
    category:      'milestones',
    entity:        'milestone / Foundation & Site Prep',
    details:       'Score: 87/100 · Pass',
    system_source: 'api/ai/draw-review',
  },
  {
    id:            'a1b2c3d4-0019-4000-8000-000000000019',
    event_seq:     974,
    timestamp_utc: '2026-02-25 15:03:29 UTC',
    actor:         'Marcus Webb',
    actor_email:   'mwebb@webbcontracting.com',
    role:          'contractor',
    action:        'Document Uploaded',
    category:      'system',
    entity:        'milestone / Foundation & Site Prep',
    details:       'Lien_Waiver_Webb.pdf',
    system_source: 'api/milestones/document',
  },
  // ── Deal creation + onboarding ────────────────────────────────────────────
  {
    id:            'a1b2c3d4-0020-4000-8000-000000000020',
    event_seq:     952,
    timestamp_utc: '2026-02-21 08:04:17 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'Deal Created',
    category:      'system',
    entity:        'deal / Riverside Mixed-Use Development',
    details:       '$2,400,000',
    system_source: 'db_trigger/audit_deals',
  },
  {
    id:            'a1b2c3d4-0021-4000-8000-000000000021',
    event_seq:     951,
    timestamp_utc: '2026-02-21 08:01:53 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'Deal Created',
    category:      'system',
    entity:        'deal / Westside Medical Office Campus',
    details:       '$4,750,000',
    system_source: 'db_trigger/audit_deals',
  },
  {
    id:            'a1b2c3d4-0022-4000-8000-000000000022',
    event_seq:     943,
    timestamp_utc: '2026-02-19 09:33:41 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'Deal Created',
    category:      'system',
    entity:        'deal / Eastside Industrial Park',
    details:       '$5,200,000',
    system_source: 'db_trigger/audit_deals',
  },
  {
    id:            'a1b2c3d4-0023-4000-8000-000000000023',
    event_seq:     938,
    timestamp_utc: '2026-02-17 10:11:28 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'Deal Created',
    category:      'system',
    entity:        'deal / Harbor Logistics Center',
    details:       '$9,100,000',
    system_source: 'db_trigger/audit_deals',
  },
  {
    id:            'a1b2c3d4-0024-4000-8000-000000000024',
    event_seq:     934,
    timestamp_utc: '2026-02-16 14:27:09 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'User Signed Up',
    category:      'system',
    entity:        'profile / Diane Reyes',
    details:       'role: contractor',
    system_source: 'db_trigger/audit_user_signup',
  },
  {
    id:            'a1b2c3d4-0025-4000-8000-000000000025',
    event_seq:     933,
    timestamp_utc: '2026-02-16 14:19:52 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'User Signed Up',
    category:      'system',
    entity:        'profile / Carlos Torres',
    details:       'role: contractor',
    system_source: 'db_trigger/audit_user_signup',
  },
  {
    id:            'a1b2c3d4-0026-4000-8000-000000000026',
    event_seq:     929,
    timestamp_utc: '2026-02-15 11:08:33 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'User Signed Up',
    category:      'system',
    entity:        'profile / James Okafor',
    details:       'role: funder',
    system_source: 'db_trigger/audit_user_signup',
  },
  {
    id:            'a1b2c3d4-0027-4000-8000-000000000027',
    event_seq:     928,
    timestamp_utc: '2026-02-15 10:55:17 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'User Signed Up',
    category:      'system',
    entity:        'profile / Marcus Webb',
    details:       'role: contractor',
    system_source: 'db_trigger/audit_user_signup',
  },
  {
    id:            'a1b2c3d4-0028-4000-8000-000000000028',
    event_seq:     927,
    timestamp_utc: '2026-02-15 10:42:06 UTC',
    actor:         'System',
    actor_email:   null,
    role:          'system',
    action:        'User Signed Up',
    category:      'system',
    entity:        'profile / Sarah Chen',
    details:       'role: funder',
    system_source: 'db_trigger/audit_user_signup',
  },
]

const categoryFilters: Record<AuditCategory, string[]> = {
  all:        [],
  funds:      ['Funds Released', 'Release Blocked'],
  milestones: ['Milestone Approved', 'Milestone Status Changed', 'AI Draw Review', 'Document Uploaded'],
  disputes:   ['Dispute Opened', 'Dispute Resolved', 'Dispute Escalated'],
  system:     ['Deal Created', 'User Signed Up', 'Release Blocked'],
}

const TAB_LABELS: Record<AuditCategory, string> = {
  all:        'All',
  funds:      'Funds',
  milestones: 'Milestones',
  disputes:   'Disputes',
  system:     'System',
}

// ── Badge helpers ───────────────────────────────────────────────────────────

function actionBadgeClasses(action: string): string {
  if (action === 'Funds Released' || action === 'Milestone Approved')
    return 'bg-emerald-500/[0.12] text-emerald-400'
  if (action === 'AI Draw Review')
    return 'bg-purple-500/[0.12] text-purple-400'
  if (action === 'Dispute Opened' || action === 'Release Blocked')
    return 'bg-red-500/[0.12] text-red-400'
  if (action === 'Deal Created' || action === 'User Signed Up')
    return 'bg-vektrum-blue/20 text-blue-300'
  return 'bg-white/[0.06] text-white/75'
}

function roleBadgeClasses(role: string): string {
  switch (role) {
    case 'funder':     return 'bg-vektrum-blue/20 text-blue-300'
    case 'contractor': return 'bg-amber-500/[0.12] text-amber-400'
    case 'admin':      return 'bg-purple-500/[0.12] text-purple-400'
    case 'system':     return 'bg-white/[0.06] text-white/75'
    default:           return 'bg-white/[0.06] text-white/75'
  }
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DemoAuditPage() {
  const [activeTab, setActiveTab] = useState<AuditCategory>('all')

  const filtered = activeTab === 'all'
    ? auditEvents
    : auditEvents.filter(e => categoryFilters[activeTab].includes(e.action))

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="page-container section space-y-6">
      {/* Back link */}
      <Link
        href="/demo-live/admin"
        className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> Back to admin dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vektrum-blue/10">
          <Shield size={18} className="text-blue-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Audit Log — Demo
          </h1>
          <p className="text-sm text-white/55">
            Showing all governance events · {auditEvents.length} total · ordered by event_sequence desc
          </p>
        </div>
      </div>

      {/* Compliance notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[12px] text-white/75">
        <Shield size={13} className="text-white/75 flex-shrink-0 mt-0.5" />
        <span>
          All timestamps are exact UTC (YYYY-MM-DD HH:MM:SS UTC). Events are ordered by
          monotonic <code className="font-mono">event_sequence</code>. This log is append-only.
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TAB_LABELS) as AuditCategory[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? 'bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium'
                : 'bg-surface-3 border border-white/[0.08] text-white/55 rounded-lg px-4 py-2 text-sm font-medium hover:bg-white/[0.06]'
            }
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Audit table */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-surface-3">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/55 whitespace-nowrap">
                  Seq / Event ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/55 whitespace-nowrap">
                  Timestamp (UTC)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/55">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/55">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/55">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/55">
                  Source / Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vektrum-border-subtle">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-surface-3 transition-colors align-top">

                  {/* ── Seq / Event ID ──────────────────────────────────── */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="font-mono text-[12px] font-semibold text-white/60 tabular-nums">
                      #{entry.event_seq}
                    </div>
                    <div className="font-mono text-[10px] text-white/70 mt-0.5" title={entry.id}>
                      {entry.id.slice(0, 8)}…
                    </div>
                  </td>

                  {/* ── Exact UTC timestamp — never relative ─────────────── */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {/* Split date and time for readability */}
                    <div className="font-mono tabular-nums text-[11px] text-white/55">
                      {entry.timestamp_utc.split(' ')[0]}
                    </div>
                    <div className="font-mono tabular-nums text-[11px] text-white/75">
                      {entry.timestamp_utc.split(' ').slice(1).join(' ')}
                    </div>
                  </td>

                  {/* ── Actor ────────────────────────────────────────────── */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white">{entry.actor}</span>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${roleBadgeClasses(entry.role)}`}>
                        {entry.role}
                      </span>
                    </div>
                    {entry.actor_email && (
                      <div className="text-[10px] font-mono text-white/75 mt-0.5 truncate max-w-[180px]">
                        {entry.actor_email}
                      </div>
                    )}
                  </td>

                  {/* ── Action ───────────────────────────────────────────── */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${actionBadgeClasses(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>

                  {/* ── Entity ───────────────────────────────────────────── */}
                  <td className="px-4 py-3 text-[13px] text-white max-w-[240px] truncate">
                    {entry.entity}
                  </td>

                  {/* ── Source + Details ─────────────────────────────────── */}
                  <td className="px-4 py-3">
                    <div className="text-[10px] font-mono text-white/75 mb-1">
                      {entry.system_source}
                    </div>
                    <div className="text-[12px] text-white/75">
                      {entry.details}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-white/75">
                    No events match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  )
}
