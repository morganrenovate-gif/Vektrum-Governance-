import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { applyAutoFix } from '@/lib/engine/reconciliation'
import { logAudit } from '@/lib/engine/audit'
import { internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── PATCH /api/admin/reconciliation/[issueId] ────────────────────────────────
//
// Resolves, acknowledges, or auto-fixes a single reconciliation issue.
// Admin only. Every action is audit-logged.
//
// Body:
//   { action: 'acknowledge',     note?: string }
//   { action: 'false_positive',  note: string  }
//   { action: 'resolve',         note: string  }
//   { action: 'auto_fix'                       }  — only for auto_fixable issues

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> },
) {
  const { issueId } = await params

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

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { action: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body must be JSON with an "action" field.' },
      { status: 400 },
    )
  }

  const { action, note } = body

  const validActions = ['acknowledge', 'false_positive', 'resolve', 'auto_fix']
  if (!validActions.includes(action)) {
    return NextResponse.json(
      {
        error: `Invalid action "${action}". Valid actions: ${validActions.join(', ')}.`,
      },
      { status: 400 },
    )
  }

  if ((action === 'resolve' || action === 'false_positive') && !note?.trim()) {
    return NextResponse.json(
      { error: `A "note" is required when action is "${action}".` },
      { status: 400 },
    )
  }

  const admin = createSupabaseAdminClient()

  // ── Fetch issue ─────────────────────────────────────────────────────────────
  const { data: issue, error: fetchError } = await admin
    .from('reconciliation_issues')
    .select('id, issue_type, severity, status, auto_fixable, deal_id, milestone_id, release_id, dedup_key')
    .eq('id', issueId)
    .single()

  if (fetchError || !issue) {
    return notFoundError(`Reconciliation issue ${issueId} was not found.`)
  }

  if (issue.status === 'resolved' || issue.status === 'auto_resolved') {
    return NextResponse.json(
      { error: `Issue is already ${issue.status}. No further action needed.` },
      { status: 409 },
    )
  }

  // ── Apply action ────────────────────────────────────────────────────────────

  let updatePayload: Record<string, unknown> = {}
  let auditAction: string
  let autoFixDescription: string | null = null

  if (action === 'acknowledge') {
    updatePayload = {
      status: 'acknowledged',
      resolution_note: note ?? null,
    }
    auditAction = 'reconciliation_issue_acknowledged'

  } else if (action === 'false_positive') {
    updatePayload = {
      status:            'false_positive',
      resolved_at:       new Date().toISOString(),
      resolved_by:       user.id,
      resolution_note:   note,
      resolution_action: 'marked_false_positive',
      // Clear dedup_key so this specific pattern can be re-detected if it recurs
      dedup_key:         `fp:${issue.dedup_key}:${Date.now()}`,
    }
    auditAction = 'reconciliation_issue_false_positive'

  } else if (action === 'resolve') {
    updatePayload = {
      status:            'resolved',
      resolved_at:       new Date().toISOString(),
      resolved_by:       user.id,
      resolution_note:   note,
      resolution_action: 'manually_resolved',
      dedup_key:         `resolved:${issue.dedup_key}:${Date.now()}`,
    }
    auditAction = 'reconciliation_issue_resolved'

  } else if (action === 'auto_fix') {
    if (!issue.auto_fixable) {
      return NextResponse.json(
        {
          error: `Issue type "${issue.issue_type}" is not eligible for auto-fix. ` +
            'It requires manual investigation and resolution.',
        },
        { status: 409 },
      )
    }

    try {
      autoFixDescription = await applyAutoFix(issueId, user.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return internalError(
        `Auto-fix failed: ${message}. The issue has not been modified.`,
        message,
      )
    }

    // applyAutoFix updates the issue itself — no further update needed
    await logAudit({
      entity_type: 'reconciliation_issue',
      entity_id:   issueId,
      action:      'reconciliation_auto_fix_applied',
      actor_id:    user.id,
      old_values:  { status: issue.status },
      new_values:  { status: 'auto_resolved' },
      metadata: {
        issue_type:       issue.issue_type,
        severity:         issue.severity,
        fix_description:  autoFixDescription,
        deal_id:          issue.deal_id,
        milestone_id:     issue.milestone_id,
        release_id:       issue.release_id,
      },
    })

    return NextResponse.json({
      success:         true,
      action:          'auto_fix',
      fix_description: autoFixDescription,
    })
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // ── Persist update ──────────────────────────────────────────────────────────
  const { error: updateError } = await admin
    .from('reconciliation_issues')
    .update(updatePayload)
    .eq('id', issueId)

  if (updateError) {
    return internalError(`Failed to update issue: ${updateError.message}`, updateError.message)
  }

  // ── Audit log ───────────────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'reconciliation_issue',
    entity_id:   issueId,
    action:      auditAction,
    actor_id:    user.id,
    old_values:  { status: issue.status },
    new_values:  updatePayload,
    metadata: {
      issue_type:   issue.issue_type,
      severity:     issue.severity,
      note:         note ?? null,
      deal_id:      issue.deal_id,
      milestone_id: issue.milestone_id,
      release_id:   issue.release_id,
    },
  })

  return NextResponse.json({ success: true, action, issue_id: issueId })
}
