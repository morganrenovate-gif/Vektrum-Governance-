import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { internalError, notFoundError } from '@/lib/errors'
import { logAudit } from '@/lib/engine/audit'

export const dynamic = 'force-dynamic'

// ─── PATCH /api/admin/audit-log/[id]/review ───────────────────────────────────
//
// Marks an admin_audit_log entry as reviewed by the current admin.
//
// FOUR-EYES ENFORCEMENT:
//   The reviewer must be a different admin from the original actor.
//   This is enforced both here (application layer) and by the
//   guard_admin_audit_immutability() DB trigger (database layer).
//
// IDEMPOTENCY:
//   If the entry is already reviewed, returns 409 Conflict.
//
// Body: (none required — reviewer is the authenticated user)
//   Optional: { note?: string }  — a review note stored in metadata

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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

  const { user } = authContext

  // ── Parse optional body ─────────────────────────────────────────────────
  let reviewNote: string | null = null
  try {
    const body = await request.json() as { note?: string }
    if (body.note && typeof body.note === 'string') {
      reviewNote = body.note.trim() || null
    }
  } catch { /* no body — acceptable */ }

  const admin = createSupabaseAdminClient()

  // ── Fetch the entry ────────────────────────────────────────────────────
  const { data: entry, error: fetchError } = await admin
    .from('admin_audit_log')
    .select('id, actor_id, action, entity_type, entity_id, reviewed_by, reviewed_at, event_sequence')
    .eq('id', id)
    .single()

  if (fetchError || !entry) {
    return notFoundError(`Admin audit log entry ${id} was not found.`)
  }

  // Already reviewed
  if (entry.reviewed_by !== null) {
    return NextResponse.json(
      {
        error:        'This entry has already been reviewed.',
        reviewed_by:  entry.reviewed_by,
        reviewed_at:  entry.reviewed_at,
      },
      { status: 409 },
    )
  }

  // Four-eyes: reviewer cannot be the actor (application layer check)
  if (entry.actor_id === user.id) {
    return NextResponse.json(
      {
        error:
          'Four-eyes policy violation: you cannot review your own admin action. ' +
          'A second admin account must perform this review.',
      },
      { status: 403 },
    )
  }

  const reviewedAt = new Date().toISOString()

  // ── Apply review ────────────────────────────────────────────────────────
  const { error: updateError } = await admin
    .from('admin_audit_log')
    .update({
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
    })
    .eq('id', id)

  if (updateError) {
    // The DB trigger may reject this (e.g. four-eyes violation) with SQLSTATE 23001
    const isConstraintViolation = updateError.code === '23001' || updateError.code === 'P0001'
    if (isConstraintViolation) {
      return NextResponse.json(
        {
          error:   'Database constraint rejected the review: ' + updateError.message,
          db_code: updateError.code,
        },
        { status: 409 },
      )
    }
    return internalError('Failed to mark entry as reviewed.', updateError.message)
  }

  // ── Audit the review action itself (to the regular audit_log only —
  //    we do NOT create an admin_audit_log entry for the review action
  //    to avoid an infinite regression) ──────────────────────────────────
  await logAudit({
    entity_type:   'admin_audit_log',
    entity_id:     id,
    action:        'admin_audit_entry_reviewed',
    actor_id:      user.id,
    actor_role:    'admin',
    actor_email:   user.email,
    system_source: 'api/admin/audit-log/review',
    new_values: {
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
    },
    metadata: {
      original_action:    entry.action,
      original_actor_id:  entry.actor_id,
      original_entity:    `${entry.entity_type}/${entry.entity_id}`,
      review_note:        reviewNote,
    },
  })

  return NextResponse.json({
    success:     true,
    id,
    reviewed_by: user.id,
    reviewed_at: reviewedAt,
  })
}
