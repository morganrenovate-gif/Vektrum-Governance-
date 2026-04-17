'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

type AuditCategory = 'all' | 'funds' | 'milestones' | 'disputes' | 'system'

interface AuditEvent {
  id: number
  time: string
  date: string
  actor: string
  role: 'funder' | 'contractor' | 'admin' | 'system'
  action: string
  category: AuditCategory
  entity: string
  details: string
}

// ── Data ────────────────────────────────────────────────────────────────────

const auditEvents: AuditEvent[] = [
  { id: 1, time: '3 days ago', date: 'April 13, 2026', actor: 'System', role: 'system', action: 'Dispute Opened', category: 'disputes', entity: 'milestone / HVAC Equipment Procurement', details: '$487,000 disputed' },
  { id: 2, time: '14 days ago', date: 'April 2, 2026', actor: 'Sarah Chen', role: 'funder', action: 'Funds Released', category: 'funds', entity: 'milestone / Building Envelope & Roofing', details: '$2,640,000 → Marcus Webb' },
  { id: 3, time: '14 days ago', date: 'April 2, 2026', actor: 'Sarah Chen', role: 'funder', action: 'Milestone Approved', category: 'milestones', entity: 'milestone / Building Envelope & Roofing', details: 'Harbor Logistics' },
  { id: 4, time: '17 days ago', date: 'March 30, 2026', actor: 'Vektrum AI', role: 'system', action: 'AI Draw Review', category: 'milestones', entity: 'milestone / Building Envelope', details: 'Score: 92/100 · Pass' },
  { id: 5, time: '17 days ago', date: 'March 30, 2026', actor: 'Marcus Webb', role: 'contractor', action: 'Document Uploaded', category: 'system', entity: 'milestone / Building Envelope', details: 'Draw_Request_4.pdf' },
  { id: 6, time: '21 days ago', date: 'March 26, 2026', actor: 'Sarah Chen', role: 'funder', action: 'Funds Released', category: 'funds', entity: 'milestone / Structural Steel Erection', details: '$1,300,000 → Marcus Webb' },
  { id: 7, time: '21 days ago', date: 'March 26, 2026', actor: 'Sarah Chen', role: 'funder', action: 'Milestone Approved', category: 'milestones', entity: 'milestone / Structural Steel Erection', details: 'Harbor Logistics' },
  { id: 8, time: '24 days ago', date: 'March 23, 2026', actor: 'Vektrum AI', role: 'system', action: 'AI Draw Review', category: 'milestones', entity: 'milestone / Structural Steel Erection', details: 'Score: 89/100 · Pass' },
  { id: 9, time: '28 days ago', date: 'March 19, 2026', actor: 'Sarah Chen', role: 'funder', action: 'Funds Released', category: 'funds', entity: 'milestone / Concrete Sub-grade & Foundations', details: '$1,840,000 → Marcus Webb' },
  { id: 10, time: '33 days ago', date: 'March 14, 2026', actor: 'Sarah Chen', role: 'funder', action: 'Funds Released', category: 'funds', entity: 'milestone / Site Preparation & Grading', details: '$320,000 → Marcus Webb' },
  { id: 11, time: '35 days ago', date: 'March 12, 2026', actor: 'System', role: 'system', action: 'Release Blocked', category: 'funds', entity: 'milestone / MEP Rough-In', details: 'AI score 58/100 — resubmit' },
  { id: 12, time: '40 days ago', date: 'March 7, 2026', actor: 'Marcus Webb', role: 'contractor', action: 'Milestone Status Changed', category: 'milestones', entity: 'milestone / MEP Rough-In', details: 'in_progress → ready_for_review' },
  { id: 13, time: '45 days ago', date: 'March 2, 2026', actor: 'Sarah Chen', role: 'funder', action: 'Funds Released', category: 'funds', entity: 'milestone / Foundation & Site Prep', details: '$480,000 → Marcus Webb' },
  { id: 14, time: '47 days ago', date: 'Feb 28, 2026', actor: 'Sarah Chen', role: 'funder', action: 'Milestone Approved', category: 'milestones', entity: 'milestone / Foundation & Site Prep', details: 'Riverside' },
  { id: 15, time: '47 days ago', date: 'Feb 28, 2026', actor: 'Vektrum AI', role: 'system', action: 'AI Draw Review', category: 'milestones', entity: 'milestone / Foundation & Site Prep', details: 'Score: 87/100 · Pass' },
  { id: 16, time: '50 days ago', date: 'Feb 25, 2026', actor: 'Marcus Webb', role: 'contractor', action: 'Document Uploaded', category: 'system', entity: 'milestone / Foundation & Site Prep', details: 'Lien_Waiver_Webb.pdf' },
  { id: 17, time: '60 days ago', date: 'Feb 15, 2026', actor: 'System', role: 'system', action: 'Deal Created', category: 'system', entity: 'deal / Harbor Logistics Center', details: '$9,100,000' },
  { id: 18, time: '60 days ago', date: 'Feb 15, 2026', actor: 'System', role: 'system', action: 'Deal Created', category: 'system', entity: 'deal / Westside Medical Office Campus', details: '$4,750,000' },
  { id: 19, time: '60 days ago', date: 'Feb 15, 2026', actor: 'System', role: 'system', action: 'User Signed Up', category: 'system', entity: 'profile / Marcus Webb', details: 'role: contractor' },
  { id: 20, time: '60 days ago', date: 'Feb 15, 2026', actor: 'System', role: 'system', action: 'User Signed Up', category: 'system', entity: 'profile / Sarah Chen', details: 'role: funder' },
]

const categoryFilters: Record<AuditCategory, string[]> = {
  all: [],
  funds: ['Funds Released', 'Release Blocked'],
  milestones: ['Milestone Approved', 'Milestone Status Changed', 'AI Draw Review', 'Document Uploaded'],
  disputes: ['Dispute Opened', 'Dispute Resolved', 'Dispute Escalated'],
  system: ['Deal Created', 'User Signed Up', 'Release Blocked'],
}

const TAB_LABELS: Record<AuditCategory, string> = {
  all: 'All',
  funds: 'Funds',
  milestones: 'Milestones',
  disputes: 'Disputes',
  system: 'System',
}

// ── Badge helpers ───────────────────────────────────────────────────────────

function actionBadgeClasses(action: string): string {
  if (action === 'Funds Released' || action === 'Milestone Approved')
    return 'bg-green-100 text-green-700'
  if (action === 'AI Draw Review')
    return 'bg-purple-100 text-purple-700'
  if (action === 'Dispute Opened' || action === 'Release Blocked')
    return 'bg-red-100 text-red-700'
  if (action === 'Deal Created' || action === 'User Signed Up')
    return 'bg-blue-100 text-blue-700'
  if (action === 'Milestone Status Changed' || action === 'Document Uploaded')
    return 'bg-gray-100 text-gray-600'
  return 'bg-gray-100 text-gray-600'
}

function roleBadgeClasses(role: string): string {
  switch (role) {
    case 'funder':
      return 'bg-blue-100 text-blue-700'
    case 'contractor':
      return 'bg-amber-100 text-amber-700'
    case 'admin':
      return 'bg-purple-100 text-purple-700'
    case 'system':
      return 'bg-gray-100 text-gray-500'
    default:
      return 'bg-gray-100 text-gray-500'
  }
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DemoAuditPage() {
  const [activeTab, setActiveTab] = useState<AuditCategory>('all')

  const filtered = activeTab === 'all'
    ? auditEvents
    : auditEvents.filter(e => categoryFilters[activeTab].includes(e.action))

  return (
    <div className="page-container section space-y-6">
      {/* Back link */}
      <Link
        href="/demo-live/admin"
        className="inline-flex items-center gap-1.5 text-sm text-vektrum-muted hover:text-vektrum-text transition-colors"
      >
        <ArrowLeft size={14} /> Back to admin dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
          <Shield size={18} className="text-vektrum-blue" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-vektrum-text">
            Audit Log — Demo
          </h1>
          <p className="text-sm text-vektrum-muted">
            Showing all governance events for the demo scenario
          </p>
        </div>
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
                : 'bg-white border border-gray-200 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50'
            }
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Audit table */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] text-sm">
            <thead>
              <tr className="border-b border-vektrum-border bg-vektrum-surface-alt">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vektrum-border-subtle">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-vektrum-surface-alt transition-colors">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="font-mono tabular-nums text-xs text-vektrum-muted">{entry.time}</div>
                    <div className="text-[11px] text-vektrum-faint">{entry.date}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-vektrum-text">{entry.actor}</span>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${roleBadgeClasses(entry.role)}`}>
                        {entry.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${actionBadgeClasses(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-vektrum-text max-w-[280px] truncate">
                    {entry.entity}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-vektrum-faint">
                    {entry.details}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-vektrum-faint">
                    No events match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
