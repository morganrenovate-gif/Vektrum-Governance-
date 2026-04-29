import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { Bell, CheckCircle2, ExternalLink } from 'lucide-react'
import { MarkAllReadButton } from '@/components/notifications/mark-all-read-button'
import type { AppNotification } from '@/lib/types'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeLabel(notification_type: string): string {
  const map: Record<string, string> = {
    change_order_submitted:                 'Change Order',
    change_order_approved:                  'Change Order Approved',
    change_order_rejected:                  'Change Order Rejected',
    funder_invited:                         'Deal Invitation',
    invite_accepted:                        'Invite Accepted',
    evidence_uploaded:                      'Evidence Uploaded',
    lien_waiver_requested:                  'Lien Waiver Requested',
    lien_waiver_uploaded:                   'Lien Waiver Uploaded',
    milestone_ready_for_review:             'Milestone Ready',
    release_authorized:                     'Release Authorized',
    release_blocked:                        'Release Blocked',
    retainage_released:                     'Retainage Released',
    dispute_opened:                         'Dispute Opened',
    dispute_resolved:                       'Dispute Resolved',
    external_payment_confirmation_required: 'External Payment',
  }
  return map[notification_type] ?? notification_type.replace(/_/g, ' ')
}

function dealLink(n: AppNotification): string | null {
  if (n.deal_id) return `/dashboard/deals/${n.deal_id}`
  return null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
    hour:  '2-digit',
    minute: '2-digit',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function NotificationsPage() {
  const supabase = await createClient()

  // ── Auth guard ────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/dashboard/notifications')

  // ── Fetch notifications for current user (RLS: recipient_user_id = uid) ──
  // We use the admin client to also fetch rows where read_at is set — the
  // session client RLS already scopes to this user; admin client here avoids
  // any edge-case RLS policy gaps on the read_at column which is a new column.
  const admin = createSupabaseAdminClient()
  const { data: rows } = await admin
    .from('notifications')
    .select('*')
    .eq('recipient_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const notifications = (rows ?? []) as AppNotification[]
  const unreadCount = notifications.filter(n => n.read_at === null).length

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-1">
            <Bell size={18} className="text-white/50" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Notifications</h1>
          </div>
          <p className="text-[13px] text-white/45 pl-7">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up'}
          </p>
        </div>

        {/* ── Mark all read (client action) ── */}
        {unreadCount > 0 && (
          <div className="mb-6 flex justify-end">
            <MarkAllReadButton />
          </div>
        )}

        {/* ── Empty state ── */}
        {notifications.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-14 text-center">
            <Bell
              size={32}
              className="mx-auto text-white/20 mb-4"
              aria-hidden="true"
            />
            <p className="text-[15px] font-medium text-white/40">
              No notifications yet
            </p>
            <p className="text-[13px] text-white/25 mt-1.5 max-w-sm mx-auto">
              Activity on your deals — change orders, milestone updates, releases —
              will appear here.
            </p>
          </div>
        )}

        {/* ── Notification list ── */}
        {notifications.length > 0 && (
          <div
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden"
            role="list"
            aria-label="All notifications"
          >
            {notifications.map(n => {
              const isUnread = n.read_at === null
              const link     = dealLink(n)
              const subject  = n.subject?.replace(/^\[Vektrum\]\s*/i, '') ?? null

              return (
                <div
                  key={n.id}
                  role="listitem"
                  className={`relative px-5 py-4 transition-colors ${
                    isUnread ? 'bg-white/[0.025]' : ''
                  }`}
                >
                  {/* Unread dot */}
                  {isUnread && (
                    <span
                      aria-hidden="true"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-vektrum-blue flex-shrink-0"
                    />
                  )}

                  <div className={`flex items-start gap-4 ${isUnread ? 'pl-2' : ''}`}>

                    {/* Read/unread icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {isUnread ? (
                        <div
                          className="h-8 w-8 rounded-full bg-vektrum-blue/10 flex items-center justify-center"
                          aria-label="Unread"
                        >
                          <Bell size={14} className="text-blue-400" aria-hidden="true" />
                        </div>
                      ) : (
                        <div
                          className="h-8 w-8 rounded-full bg-white/[0.04] flex items-center justify-center"
                          aria-label="Read"
                        >
                          <CheckCircle2 size={14} className="text-white/25" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                          {typeLabel(n.notification_type)}
                        </span>
                        <span className="text-[10px] text-white/25 tabular-nums flex-shrink-0">
                          {formatDate(n.created_at)}
                        </span>
                        {isUnread && (
                          <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-blue-400/80 flex-shrink-0">
                            Unread
                          </span>
                        )}
                      </div>

                      {subject && (
                        <p className="text-[13px] font-medium text-white/85 leading-snug">
                          {subject}
                        </p>
                      )}

                      {n.body_summary && (
                        <p className="text-[12px] text-white/45 mt-1 leading-relaxed">
                          {n.body_summary}
                        </p>
                      )}
                    </div>

                    {/* Deal link */}
                    {link && (
                      <Link
                        href={link}
                        aria-label="View deal"
                        className="flex-shrink-0 flex items-center gap-1 rounded-md border border-white/[0.10] px-2.5 py-1.5 text-[11px] font-medium text-white/50 hover:text-white/85 hover:border-white/25 hover:bg-white/[0.04] transition-colors mt-0.5"
                      >
                        <ExternalLink size={11} aria-hidden="true" />
                        View deal
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
