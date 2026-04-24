import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/ops/search?q=... ─────────────────────────────────────────
//
// Full-text search across deals, profiles (users), and releases/transfers.
// Designed for ops/support to locate any entity quickly by partial name,
// email, deal title, or Stripe ID.
//
// Searches:
//   Deals      — title (ilike), description (ilike)
//   Profiles   — full_name (ilike), company_name (ilike), stripe_account_id (ilike)
//   Auth users — email (via auth.admin.listUsers, matched client-side)
//   Releases   — stripe_transfer_id (ilike)
//
// Query params:
//   q        required, min 2 chars — the search term
//   limit    optional, max 20 per category (default 10)
//
// Returns grouped results: { deals[], profiles[], releases[] }
// Each result includes enough context for the ops UI to display and link.
//
// Admin-only. Read-only.

const MAX_RESULTS_PER_CATEGORY = 20

export async function GET(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  try {
    requireRole(authContext.profile, 'admin')
  } catch (err) {
    return err as NextResponse
  }

  const supabase = await createClient()
  try {
    await requireMFA(supabase, authContext.profile)
  } catch (err) {
    return err as NextResponse
  }

  const url   = new URL(request.url)
  const query = url.searchParams.get('q')?.trim() ?? ''

  if (query.length < 2) {
    return NextResponse.json(
      { error: 'Search query must be at least 2 characters.' },
      { status: 400 },
    )
  }

  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '10', 10) || 10,
    MAX_RESULTS_PER_CATEGORY,
  )

  const adminClient = createSupabaseAdminClient()
  const q = `%${query}%`

  // Run all three DB searches in parallel
  const [dealsResult, profilesResult, releasesResult] = await Promise.all([
    // ── Deals ───────────────────────────────────────────────────────────────
    adminClient
      .from('deals')
      .select(`
        id, title, description, total_amount, status, created_at,
        contractor:profiles!deals_contractor_id_fkey ( id, full_name, company_name ),
        funder:profiles!deals_funder_id_fkey         ( id, full_name, company_name )
      `)
      .or(`title.ilike.${q},description.ilike.${q}`)
      .order('created_at', { ascending: false })
      .limit(limit),

    // ── Profiles ─────────────────────────────────────────────────────────────
    adminClient
      .from('profiles')
      .select('id, full_name, company_name, role, stripe_account_id, stripe_payouts_enabled, onboarding_complete, created_at')
      .or(`full_name.ilike.${q},company_name.ilike.${q},stripe_account_id.ilike.${q}`)
      .order('created_at', { ascending: false })
      .limit(limit),

    // ── Releases / transfers ─────────────────────────────────────────────────
    adminClient
      .from('releases')
      .select(`
        id, milestone_id, deal_id, amount, stripe_transfer_id,
        transfer_status, released_at, failure_code, failure_message, failed_at,
        milestones ( id, title,
          deals ( id, title )
        )
      `)
      .ilike('stripe_transfer_id', q)
      .order('released_at', { ascending: false })
      .limit(limit),
  ])

  if (dealsResult.error) {
    return internalError('Deal search failed.', dealsResult.error.message)
  }
  if (profilesResult.error) {
    return internalError('Profile search failed.', profilesResult.error.message)
  }

  // ── Fetch auth.users emails for profiles found, and for email-based search ──
  // We search auth.users emails separately (not stored in profiles table).
  let emailMatchedProfileIds: string[] = []
  let profileEmailMap: Record<string, string> = {}

  try {
    // Paginate auth.admin.listUsers to find email matches.
    // Supabase admin.listUsers does not support a filter param, so we fetch
    // pages until we hit a full match. Cap at 3 pages (300 users) for perf.
    // For large tenants, a dedicated search-by-email endpoint is needed.
    let page = 1
    const perPage = 100
    const maxPages = 3
    let done = false

    while (!done && page <= maxPages) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      })
      if (error || !data) break

      for (const u of data.users) {
        profileEmailMap[u.id] = u.email ?? ''
        if (u.email?.toLowerCase().includes(query.toLowerCase())) {
          emailMatchedProfileIds.push(u.id)
        }
      }

      done = data.users.length < perPage
      page++
    }
  } catch {
    // Email search is best-effort — profile name search still works
  }

  // Fetch any profiles matched by email that aren't already in the profile results
  const existingProfileIds = new Set((profilesResult.data ?? []).map((p) => p.id))
  const additionalProfileIds = emailMatchedProfileIds.filter((id) => !existingProfileIds.has(id))

  let additionalProfiles: typeof profilesResult.data = []
  if (additionalProfileIds.length > 0) {
    const { data: extra } = await adminClient
      .from('profiles')
      .select('id, full_name, company_name, role, stripe_account_id, stripe_payouts_enabled, onboarding_complete, created_at')
      .in('id', additionalProfileIds.slice(0, limit))

    additionalProfiles = extra ?? []
  }

  const allProfiles = [...(profilesResult.data ?? []), ...additionalProfiles]

  // ── Shape response ────────────────────────────────────────────────────────

  type ParticipantJoin = { id: string; full_name: string | null; company_name: string | null } | null
  type MilestoneJoin   = { id: string; title: string; deals: { id: string; title: string } | null } | null

  function displayName(p: { full_name: string | null; company_name: string | null } | null) {
    return p?.full_name ?? p?.company_name ?? 'Unknown'
  }

  const deals = (dealsResult.data ?? []).map((d) => {
    const contractor = d.contractor as unknown as ParticipantJoin
    const funder     = d.funder     as unknown as ParticipantJoin
    return {
      id:               d.id,
      title:            d.title,
      description:      d.description,
      total_amount:     d.total_amount,
      status:           d.status,
      created_at:       d.created_at,
      contractor_name:  displayName(contractor),
      contractor_id:    contractor?.id ?? null,
      funder_name:      displayName(funder),
      funder_id:        funder?.id ?? null,
      match_on:         'title' as const,
    }
  })

  const profiles = allProfiles.map((p) => ({
    id:                       p.id,
    display_name:             p.full_name ?? p.company_name ?? 'Unknown',
    full_name:                p.full_name,
    company_name:             p.company_name,
    email:                    profileEmailMap[p.id] ?? null,
    role:                     p.role,
    stripe_account_id:        p.stripe_account_id,
    stripe_payouts_enabled:   p.stripe_payouts_enabled,
    onboarding_complete:      p.onboarding_complete,
    created_at:               p.created_at,
  }))

  const releases = (releasesResult.data ?? []).map((r) => {
    const milestone = r.milestones as unknown as MilestoneJoin
    return {
      id:                  r.id,
      milestone_id:        r.milestone_id,
      deal_id:             r.deal_id,
      amount:              r.amount,
      stripe_transfer_id:  r.stripe_transfer_id,
      transfer_status:     r.transfer_status,
      released_at:         r.released_at,
      failure_code:        r.failure_code,
      failure_message:     r.failure_message,
      failed_at:           r.failed_at,
      milestone_title:     milestone?.title ?? null,
      deal_title:          milestone?.deals?.title ?? null,
    }
  })

  const total = deals.length + profiles.length + releases.length

  return NextResponse.json({
    query,
    total,
    results: {
      deals,
      profiles,
      releases,
    },
  })
}
