'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, ExternalLink, X } from 'lucide-react'
import type { AppNotification } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps notification_type to a short human-readable label. */
function typeLabel(notification_type: string): string {
  const map: Record<string, string> = {
    change_order_submitted:               'Change order',
    change_order_approved:                'Change order approved',
    change_order_rejected:                'Change order rejected',
    funder_invited:                       'Deal invitation',
    invite_accepted:                      'Invite accepted',
    evidence_uploaded:                    'Evidence uploaded',
    lien_waiver_requested:                'Lien waiver requested',
    lien_waiver_uploaded:                 'Lien waiver uploaded',
    milestone_ready_for_review:           'Milestone ready',
    release_authorized:                   'Release authorized',
    release_blocked:                      'Release blocked',
    retainage_released:                   'Retainage released',
    dispute_opened:                       'Dispute opened',
    dispute_resolved:                     'Dispute resolved',
    external_payment_confirmation_required: 'External payment',
  }
  return map[notification_type] ?? notification_type.replace(/_/g, ' ')
}

/** Builds a deal link path when deal_id is available. */
function dealLink(n: AppNotification): string | null {
  if (n.deal_id) return `/dashboard/deals/${n.deal_id}`
  return null
}

/** Relative time label — shows "just now", "Xm ago", "Xh ago", or date. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)  return `${diffHr}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen]               = useState(false)
  const [loading, setLoading]         = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [markingAll, setMarkingAll]   = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // ── Fetch on mount and when dropdown opens ────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? [])
        setUnreadCount(data.unread_count ?? 0)
      }
    } catch {
      // Silent — unread count just won't update
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // ── Open/close ────────────────────────────────────────────────────────────
  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next) fetchNotifications()
  }

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // ── Mark one as read ──────────────────────────────────────────────────────
  const markOneRead = async (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n),
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {
      // Optimistic update already applied; failure is non-fatal
    }
  }

  // ── Mark all as read ──────────────────────────────────────────────────────
  const markAllRead = async () => {
    if (unreadCount === 0) return
    setMarkingAll(true)
    const now = new Date().toISOString()
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })))
    setUnreadCount(0)
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch {
      // Silent — optimistic update stands
    } finally {
      setMarkingAll(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell trigger */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/65 hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-vektrum-blue"
      >
        <Bell size={17} aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-vektrum-blue px-[3px] text-[9px] font-bold text-white leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-[360px] rounded-xl border border-white/[0.08] bg-surface-2 shadow-lg z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.05]">
            <p className="text-[13px] font-semibold text-white">Notifications</p>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={markingAll}
                  title="Mark all as read"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-white/55 hover:text-white/85 hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                >
                  <CheckCheck size={12} aria-hidden="true" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 hover:text-white/75 hover:bg-white/[0.06] transition-colors"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto" role="list" aria-label="Notification list">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-white/35">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={22} className="mx-auto text-white/20 mb-3" aria-hidden="true" />
                <p className="text-[13px] font-medium text-white/40">No notifications yet</p>
                <p className="text-[11px] text-white/25 mt-1">
                  Activity on your deals will appear here.
                </p>
              </div>
            ) : (
              notifications.map(n => {
                const isUnread = n.read_at === null
                const link = dealLink(n)

                return (
                  <div
                    key={n.id}
                    role="listitem"
                    className={`group relative px-4 py-3 border-b border-white/[0.04] last:border-0 transition-colors ${
                      isUnread ? 'bg-white/[0.025]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Unread dot */}
                    {isUnread && (
                      <span
                        aria-hidden="true"
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-vektrum-blue flex-shrink-0"
                      />
                    )}

                    <div className={`flex items-start justify-between gap-2 ${isUnread ? 'pl-2' : ''}`}>
                      <div className="min-w-0 flex-1">
                        {/* Type label + timestamp */}
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                            {typeLabel(n.notification_type)}
                          </span>
                          <span className="text-[10px] text-white/30 tabular-nums flex-shrink-0">
                            {relativeTime(n.created_at)}
                          </span>
                        </div>

                        {/* Subject / summary */}
                        {n.subject && (
                          <p className="text-[12px] font-medium text-white/80 leading-snug truncate">
                            {n.subject.replace(/^\[Vektrum\]\s*/i, '')}
                          </p>
                        )}
                        {n.body_summary && (
                          <p className="text-[11px] text-white/45 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.body_summary}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        {link && (
                          <Link
                            href={link}
                            onClick={() => { setOpen(false); if (isUnread) markOneRead(n.id) }}
                            aria-label="View deal"
                            className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                          >
                            <ExternalLink size={11} aria-hidden="true" />
                          </Link>
                        )}
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => markOneRead(n.id)}
                            title="Mark as read"
                            aria-label="Mark as read"
                            className="flex h-6 w-6 items-center justify-center rounded text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                          >
                            <CheckCheck size={11} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer — view all link */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/[0.05] text-center">
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="text-[11px] text-white/45 hover:text-white/75 transition-colors"
              >
                View all notifications →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
