import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/audit-log ─────────────────────────────────────────────────
//
// Returns paginated admin_audit_log entries with optional filters.
// Admin only. Read-only.
//
// Query params:
//   action     — filter by action (exact match)
//   actor_id   — filter by actor UUID
//   unreviewed — 'true' to return only entries where reviewed_by IS NULL
//   start_date — ISO date string (inclusive lower bound on created_at)
//   end_date   — ISO date string (inclusive upper bound on created_at)
//   limit      — max rows (default 50, max 200)
//   offset     — pagination offset (default 0)

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
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

  // ── Parse query params ──────────────────────────────────────────────────────
  const { searchParams } = request.nextUrl
  const action     = searchParams.get('action')
  const actorId    = searchParams.get('actor_id')
  const unreviewed = searchParams.get('unreviewed') === 'true'
  const startDate  = searchParams.get('start_date')
  const endDate    = searchParams.get('end_date')
  const limit      = Math.min(parseInt(searchParams.get('limit')  ?? '50',  10), 200)
  const offset     = parseInt(searchParams.get('offset') ?? '0',  10)

  const admin = createSupabaseAdminClient()

  let query = admin
    .from('admin_audit_log')
    .select(
      `id, event_sequence, entity_type, entity_id, action,
       actor_id, actor_role, actor_name, actor_email,
       system_source, ip_address, created_at,
       admin_justification, authorization_reference,
       reviewed_by, reviewed_at,
       old_values, new_values, metadata`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action)     query = query.eq('action', action)
  if (actorId)    query = query.eq('actor_id', actorId)
  if (unreviewed) query = query.is('reviewed_by', null)
  if (startDate)  query = query.gte('created_at', startDate)
  if (endDate)    query = query.lte('created_at', endDate)

  const { data: entries, error, count } = await query

  if (error) {
    return internalError('Failed to fetch admin audit log entries.', error.message)
  }

  return NextResponse.json({
    entries:    entries ?? [],
    total:      count   ?? 0,
    limit,
    offset,
    unreviewed_count: unreviewed ? (count ?? 0) : undefined,
  })
}
