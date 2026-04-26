// src/app/dashboard/admin/users/[userId]/page.tsx
//
// Admin-only user detail page.
// Accessible only to authenticated admins (server-side role gate).
// Shows user profile, Stripe status, and all associated deals.
// Read-only — no financial actions, no role editing.

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import type { Profile, Deal } from '@/lib/types'
import { formatMoney } from '@/lib/utils'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Calendar,
  Building2,
  User,
  DollarSign,
  FileText,
} from 'lucide-react'

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getUserDetail(targetUserId: string): Promise<{
  profile: (Profile & { company_name?: string | null }) | null
  email: string | null
  deals: Deal[]
}> {
  const adminClient = createSupabaseAdminClient()

  // Load profile from DB
  const { data: profileRow } = await adminClient
    .from('profiles')
    .select(
      'id, role, full_name, company_name, stripe_account_id, ' +
      'stripe_payouts_enabled, onboarding_complete, subscription_tier, ' +
      'created_at, updated_at'
    )
    .eq('id', targetUserId)
    .maybeSingle()

  if (!profileRow) return { profile: null, email: null, deals: [] }

  // Fetch email from auth.users (never stored in profiles)
  let email: string | null = null
  try {
    const { data: authUser } = await adminClient.auth.admin.getUserById(targetUserId)
    email = authUser?.user?.email ?? null
  } catch {
    // Non-fatal — email display is best-effort
  }

  // Load all deals where the user is contractor or funder
  const { data: dealsRaw } = await adminClient
    .from('deals')
    .select(
      'id, title, status, total_amount, funded_amount, released_amount, ' +
      'contractor_id, funder_id, created_at'
    )
    .or(`contractor_id.eq.${targetUserId},funder_id.eq.${targetUserId}`)
    .order('created_at', { ascending: false })

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profile: profileRow as unknown as Profile & { company_name?: string | null },
    email,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deals: (dealsRaw ?? []) as unknown as Deal[],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  contractor: 'bg-vektrum-blue/10 border-vektrum-blue/20 text-vektrum-blue',
  funder:     'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400',
  admin:      'bg-amber-500/[0.08] border-amber-500/20 text-amber-400',
}

const STATUS_COLORS: Record<string, string> = {
  active:      'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  in_progress: 'bg-vektrum-blue/10 border-vektrum-blue/20 text-vektrum-blue',
  completed:   'bg-white/[0.06] border-white/[0.12] text-white/65',
  draft:       'bg-white/[0.04] border-white/[0.08] text-white/50',
  disputed:    'bg-amber-500/10 border-amber-500/20 text-amber-400',
  cancelled:   'bg-white/[0.04] border-white/[0.08] text-white/40',
  frozen:      'bg-red-500/10 border-red-500/20 text-red-400',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  return { title: 'User Detail — Admin — Vektrum' }
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  // ── Auth gate — admin only ─────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user: sessionUser } } = await supabase.auth.getUser()
  if (!sessionUser) redirect('/auth/login?next=/dashboard/admin')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessionProfile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', sessionUser.id)
    .single()

  if (!sessionProfile || sessionProfile.role !== 'admin') {
    redirect('/dashboard')
  }

  // ── Resolve target user ───────────────────────────────────────────────────
  const { userId } = await params
  if (!userId || typeof userId !== 'string') notFound()

  const { profile, email, deals } = await getUserDetail(userId)
  if (!profile) notFound()

  // ── Partition deals by relationship ───────────────────────────────────────
  const dealsAsFunder     = deals.filter((d) => d.funder_id     === userId)
  const dealsAsContractor = deals.filter((d) => d.contractor_id === userId)

  const stripeOk  = profile.stripe_payouts_enabled
  const hasStripe = !!profile.stripe_account_id

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page">

        {/* Back nav */}
        <div>
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 text-[13px] text-white/65 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Admin dashboard
          </Link>
        </div>

        {/* Profile header card */}
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

            {/* Identity */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                <User size={20} className="text-white/65" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-xl font-bold text-white tracking-tight truncate">
                  {profile.full_name ?? 'No name'}
                </h1>
                {email && (
                  <p className="text-[13px] text-white/65 mt-0.5">{email}</p>
                )}
                {profile.company_name && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Building2 size={12} className="text-white/50" aria-hidden="true" />
                    <p className="text-[12px] text-white/65">{profile.company_name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Role badge */}
            <span
              className={`inline-flex self-start rounded-full border px-3 py-1 text-[11px] font-semibold capitalize flex-shrink-0 ${
                ROLE_COLORS[profile.role] ?? 'bg-surface-3 border-white/[0.12] text-white/80'
              }`}
            >
              {profile.role}
            </span>
          </div>

          {/* Meta grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">

            {/* Stripe status */}
            <div className="rounded-lg bg-surface-3 border border-white/[0.06] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50 mb-1.5">
                Stripe
              </p>
              {hasStripe ? (
                <div className="flex items-center gap-1.5">
                  {stripeOk ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span className="text-[12px] font-medium text-emerald-400">Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={13} className="text-amber-400" />
                      <span className="text-[12px] font-medium text-amber-400">Pending</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <XCircle size={13} className="text-white/40" />
                  <span className="text-[12px] text-white/50">Not connected</span>
                </div>
              )}
            </div>

            {/* Joined */}
            <div className="rounded-lg bg-surface-3 border border-white/[0.06] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50 mb-1.5">
                Joined
              </p>
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-white/50" />
                <span className="text-[12px] text-white/80">{fmtDate(profile.created_at)}</span>
              </div>
            </div>

            {/* Deal count */}
            <div className="rounded-lg bg-surface-3 border border-white/[0.06] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50 mb-1.5">
                Deals
              </p>
              <div className="flex items-center gap-1.5">
                <FileText size={12} className="text-white/50" />
                <span className="text-[12px] font-semibold text-white">
                  {deals.length} deal{deals.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Subscription tier */}
            <div className="rounded-lg bg-surface-3 border border-white/[0.06] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50 mb-1.5">
                Plan
              </p>
              <span className="text-[12px] font-medium text-white/80 capitalize">
                {profile.subscription_tier ?? 'standalone'}
              </span>
            </div>
          </div>

          {/* User ID — read-only reference for support */}
          <div className="mt-4 rounded-lg bg-surface-3 border border-white/[0.06] px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 mb-0.5">
              User ID (read-only)
            </p>
            <p className="font-mono text-[11px] text-white/60 break-all select-all">{profile.id}</p>
          </div>
        </div>

        {/* ── Deals as funder ─────────────────────────────────────────────── */}
        {dealsAsFunder.length > 0 && (
          <section>
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50 mb-0.5">
                Deals
              </p>
              <h2 className="text-[15px] font-semibold text-white">
                As funder
                <span className="ml-2 text-[12px] font-normal text-white/50">
                  ({dealsAsFunder.length})
                </span>
              </h2>
            </div>
            <DealTable deals={dealsAsFunder} currentUserId={userId} role="funder" />
          </section>
        )}

        {/* ── Deals as contractor ──────────────────────────────────────────── */}
        {dealsAsContractor.length > 0 && (
          <section>
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50 mb-0.5">
                Deals
              </p>
              <h2 className="text-[15px] font-semibold text-white">
                As contractor
                <span className="ml-2 text-[12px] font-normal text-white/50">
                  ({dealsAsContractor.length})
                </span>
              </h2>
            </div>
            <DealTable deals={dealsAsContractor} currentUserId={userId} role="contractor" />
          </section>
        )}

        {/* Empty state */}
        {deals.length === 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 px-6 py-12 text-center">
            <FileText size={28} className="text-white/25 mx-auto mb-3" />
            <p className="text-[14px] font-medium text-white/65">No deals found for this user.</p>
            <p className="text-[12px] text-white/40 mt-1">
              This user has not been added to any deals as a funder or contractor.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── DealTable sub-component ──────────────────────────────────────────────────

function DealTable({
  deals,
  currentUserId,
  role,
}: {
  deals: Deal[]
  currentUserId: string
  role: 'funder' | 'contractor'
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden shadow-card">
      {/* Column headers */}
      <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-white/[0.05] bg-white/[0.015]">
        {['Deal', 'Status', 'Total', 'Released', ''].map((h) => (
          <p key={h} className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
            {h}
          </p>
        ))}
      </div>

      <div className="divide-y divide-white/[0.04]">
        {deals.map((deal) => {
          const statusClass =
            STATUS_COLORS[deal.status] ?? 'bg-white/[0.04] border-white/[0.08] text-white/50'

          return (
            <div
              key={deal.id}
              className="flex flex-col gap-2 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-center md:gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
            >
              {/* Title */}
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{deal.title}</p>
                <p className="text-[10px] font-mono text-white/35 mt-0.5">{deal.id.slice(0, 8)}…</p>
              </div>

              {/* Status badge */}
              <div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${statusClass}`}
                >
                  {deal.status.replace('_', ' ')}
                </span>
              </div>

              {/* Total */}
              <div>
                <span className="text-[13px] tabular-nums text-white/80">
                  {formatMoney(deal.total_amount)}
                </span>
              </div>

              {/* Released */}
              <div>
                <span className="text-[13px] tabular-nums text-white/65">
                  {formatMoney(deal.released_amount)}
                </span>
              </div>

              {/* Link */}
              <div>
                <Link
                  href={`/dashboard/deals/${deal.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.18] transition-all whitespace-nowrap"
                >
                  <DollarSign size={11} aria-hidden="true" />
                  View deal
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-white/[0.05] px-5 py-3 bg-white/[0.015]">
        <p className="text-[11px] text-white/40">
          {deals.length} deal{deals.length !== 1 ? 's' : ''} as {role} · All financial actions are governed by the release gate.
        </p>
      </div>
    </div>
  )
}
