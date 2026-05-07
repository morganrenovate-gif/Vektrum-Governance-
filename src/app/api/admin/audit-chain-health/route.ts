import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import {
  runAndRecordAuditChainHealth,
  getRecentAuditChainHealth,
} from '@/lib/engine/audit-chain-health'
import { logAdminAudit } from '@/lib/engine/audit'

export const dynamic = 'force-dynamic'

// ─── /api/admin/audit-chain-health ───────────────────────────────────────────
//
// Admin-visible audit-chain health. Same auth gate as every other /api/admin/*
// route (admin role + AAL2 MFA).
//
//   GET  → returns the most recent N rows (default 1; ?limit=10 for history)
//   POST → triggers an immediate verification run (manual recheck)
//
// Public is never exposed — the underlying table is admin-only at the RLS
// layer, and these routes also enforce admin + MFA at the API layer.

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  let authContext
  try { authContext = await getAuthUser(request) } catch (err) { return err as NextResponse }
  try { requireRole(authContext.profile, 'admin') } catch (err) { return err as NextResponse }
  const supabase = await createClient()
  try { await requireMFA(supabase, authContext.profile) } catch (err) { return err as NextResponse }

  const url   = new URL(request.url)
  const raw   = url.searchParams.get('limit')
  const parsed = raw === null ? 1 : parseInt(raw, 10)
  const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : 1

  const rows = await getRecentAuditChainHealth(limit)

  return NextResponse.json({
    latest:  rows[0] ?? null,
    history: rows,
    count:   rows.length,
  })
}

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  let authContext
  try { authContext = await getAuthUser(request) } catch (err) { return err as NextResponse }
  try { requireRole(authContext.profile, 'admin') } catch (err) { return err as NextResponse }
  const supabase = await createClient()
  try { await requireMFA(supabase, authContext.profile) } catch (err) { return err as NextResponse }

  const result = await runAndRecordAuditChainHealth('admin_manual')

  // logAdminAudit requires a justification (≥20 chars). For manual rechecks
  // triggered from the admin UI we record the action with a fixed system
  // justification — the admin presence is captured via actor_id and the
  // dual-write into admin_audit_log.
  try {
    await logAdminAudit({
      entity_type:         'audit_chain_health',
      entity_id:           result.recordedAs ?? 'global',
      action:              'audit_chain_verification_manual',
      actor_id:            authContext.user.id,
      actor_role:          'admin',
      admin_justification:
        'Admin-triggered audit-chain verification via /api/admin/audit-chain-health.',
      metadata: {
        status:                       result.status,
        rows_checked:                 result.rowsChecked,
        rows_invalid:                 result.rowsInvalid,
        duration_ms:                  result.durationMs,
        first_broken_event_sequence:  result.firstBrokenEventSequence,
      },
    })
  } catch (err) {
    console.error('[admin/audit-chain-health] logAdminAudit failed:', err)
    // Do not fail the request — the verification ran and was recorded.
  }

  return NextResponse.json({
    status:                       result.status,
    rows_checked:                 result.rowsChecked,
    rows_invalid:                 result.rowsInvalid,
    duration_ms:                  result.durationMs,
    first_broken_event_sequence:  result.firstBrokenEventSequence,
    first_broken_audit_id:        result.firstBrokenAuditId,
    recorded_as:                  result.recordedAs,
  })
}
