import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/stripe/duplicates ─────────────────────────────────────────
//
// Admin-only endpoint. Invokes the database function
// audit_stripe_account_duplicates() and returns any stripe_account_id values
// currently shared by more than one profile.
//
// An empty `duplicates` array means the database is clean.
//
// Also returns a summary of recent stripe_account_conflict_attempted audit
// events so admins can see historical conflict attempts alongside the live scan.

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

  const { user } = authContext
  const adminClient = createSupabaseAdminClient()

  // ── Run the duplicate scan ─────────────────────────────────────────────────
  const { data: duplicates, error: scanError } = await adminClient.rpc(
    'audit_stripe_account_duplicates',
  )

  if (scanError) {
    console.error('[admin/stripe/duplicates] Scan failed:', scanError.message)
    return NextResponse.json(
      { error: 'Duplicate scan failed. Check server logs.', detail: scanError.message },
      { status: 500 },
    )
  }

  // ── Fetch recent conflict attempts from audit_log ──────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentAttempts } = await (adminClient as any)
    .from('audit_log')
    .select('id, entity_id, actor_id, metadata, created_at')
    .eq('action', 'stripe_account_conflict_attempted')
    .order('created_at', { ascending: false })
    .limit(50) as { data: Array<{
      id: string
      entity_id: string
      actor_id: string | null
      metadata: Record<string, unknown> | null
      created_at: string
    }> | null }

  // ── Audit this admin scan ─────────────────────────────────────────────────
  await logAudit({
    entity_type: 'profile',
    entity_id:   user.id,
    action:      'admin_stripe_duplicate_scan',
    actor_id:    user.id,
    old_values:  null,
    new_values:  null,
    metadata: {
      duplicates_found:  (duplicates ?? []).length,
      scanned_by:        user.id,
      recent_attempts:   (recentAttempts ?? []).length,
    },
  })

  const duplicateCount = (duplicates ?? []).length
  const clean          = duplicateCount === 0

  return NextResponse.json({
    clean,
    scanned_at:       new Date().toISOString(),
    duplicate_count:  duplicateCount,
    // Each row: { stripe_account_id, profile_count, profile_ids[], profile_names[], oldest_created_at, newest_updated_at }
    duplicates:       duplicates ?? [],
    // Recent conflict attempts (last 50)
    recent_conflict_attempts: (recentAttempts ?? []).map((a) => ({
      audit_id:                      a.id,
      detected_at:                   a.created_at,
      attempted_profile_id:          a.entity_id,
      conflicting_stripe_account_id: (a.metadata?.conflicting_stripe_account_id as string) ?? null,
      existing_profile_id:           (a.metadata?.existing_profile_id as string) ?? null,
      operation:                     (a.metadata?.operation as string) ?? null,
    })),
    message: clean
      ? 'Database is clean — no duplicate Stripe account IDs found.'
      : `${duplicateCount} duplicate Stripe account group(s) found. Immediate review required.`,
  })
}
