import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Audit-chain health verification.
 *
 * Runs verify_audit_chain() across the entire audit_log (no entity filter)
 * and records the result in public.audit_chain_health.
 *
 * Called by:
 *   - /api/cron/audit-chain-health   (CRON_SECRET-gated, daily)
 *   - /api/admin/audit-chain-health  (admin + MFA POST, ad-hoc)
 *
 * Read by:
 *   - /api/admin/audit-chain-health  (GET — latest + history)
 *   - src/app/dashboard/admin/page.tsx (badge in admin UI)
 *
 * NEVER mutates audit_log. NEVER reads audit_log payloads. The verifier RPC
 * returns hashes only; this module passes those hashes through to a separate
 * append-only history table.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditChainStatus = 'healthy' | 'broken' | 'error'
export type TriggeredBy      = 'cron' | 'admin_manual'

/**
 * One verifier-row result. Mirrors the columns returned by the
 * verify_audit_chain() RPC (migration 20260424000004).
 */
interface VerifierRow {
  audit_id:            string
  event_seq:           number
  row_hash_valid:      boolean
  chain_hash_valid:    boolean
  stored_row_hash:     string
  computed_row_hash:   string
  stored_chain_hash:   string
  expected_chain_hash: string
}

export interface AuditChainHealthRow {
  id:                            string
  checked_at:                    string
  status:                        AuditChainStatus
  rows_checked:                  number
  rows_invalid:                  number
  first_broken_event_sequence:   number | null
  first_broken_audit_id:         string | null
  duration_ms:                   number
  error_message:                 string | null
  triggered_by:                  TriggeredBy
}

export interface RunAuditChainResult {
  status:                        AuditChainStatus
  rowsChecked:                   number
  rowsInvalid:                   number
  firstBrokenEventSequence:      number | null
  firstBrokenAuditId:            string | null
  durationMs:                    number
  errorMessage:                  string | null
  /** Persisted row id, or null if the insert itself failed (logged, not thrown). */
  recordedAs:                    string | null
}

// ─── Pure helpers (testable in isolation) ─────────────────────────────────────

/**
 * Reduce the verifier output to a structured summary suitable for storage.
 * Pure function — no I/O, no side effects.
 *
 * Status semantics:
 *   - healthy: every row passed both checks
 *   - broken:  at least one row failed
 *   - error:   not produced here (only the runner uses 'error' for RPC failure)
 */
export function summarizeVerifierRows(
  rows: VerifierRow[],
): {
  status:                   'healthy' | 'broken'
  rowsChecked:              number
  rowsInvalid:              number
  firstBrokenEventSequence: number | null
  firstBrokenAuditId:       string | null
} {
  let invalid = 0
  let firstBrokenSeq: number | null = null
  let firstBrokenId:  string | null = null

  for (const r of rows) {
    const ok = r.row_hash_valid && r.chain_hash_valid
    if (!ok) {
      invalid += 1
      if (firstBrokenSeq === null) {
        firstBrokenSeq = r.event_seq
        firstBrokenId  = r.audit_id
      }
    }
  }

  return {
    status:                   invalid === 0 ? 'healthy' : 'broken',
    rowsChecked:              rows.length,
    rowsInvalid:              invalid,
    firstBrokenEventSequence: firstBrokenSeq,
    firstBrokenAuditId:       firstBrokenId,
  }
}

/**
 * Sanitize an error message for safe storage. Caps length and strips
 * newlines so we never persist a stack trace in audit_chain_health.
 * Pure function.
 */
export function sanitizeErrorMessage(input: unknown): string {
  const raw = input instanceof Error ? input.message : String(input ?? '')
  const firstLine = (raw.split('\n')[0] ?? 'unknown').trim()
  return firstLine.slice(0, 500)
}

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Run the full chain verification and persist the result.
 *
 * Never throws. RPC failures are caught, recorded with status='error', and
 * returned as part of the result. This guarantees the cron route always
 * completes and always leaves a row in audit_chain_health describing what
 * happened.
 */
export async function runAndRecordAuditChainHealth(
  triggeredBy: TriggeredBy,
): Promise<RunAuditChainResult> {
  const admin    = createSupabaseAdminClient()
  const startMs  = Date.now()

  let summary: {
    status:                   AuditChainStatus
    rowsChecked:              number
    rowsInvalid:              number
    firstBrokenEventSequence: number | null
    firstBrokenAuditId:       string | null
    errorMessage:             string | null
  }

  try {
    // p_entity_type=NULL, p_entity_id=NULL → verify the entire audit_log.
    const { data, error } = await admin.rpc('verify_audit_chain', {
      p_entity_type: null,
      p_entity_id:   null,
    })

    if (error) {
      console.error('[audit-chain-health] verify_audit_chain RPC failed:', error.message)
      summary = {
        status:                   'error',
        rowsChecked:              0,
        rowsInvalid:              0,
        firstBrokenEventSequence: null,
        firstBrokenAuditId:       null,
        errorMessage:             sanitizeErrorMessage(error.message),
      }
    } else {
      const reduced = summarizeVerifierRows((data ?? []) as VerifierRow[])
      summary = { ...reduced, errorMessage: null }
    }
  } catch (err) {
    console.error('[audit-chain-health] Unexpected error during verification:', err)
    summary = {
      status:                   'error',
      rowsChecked:              0,
      rowsInvalid:              0,
      firstBrokenEventSequence: null,
      firstBrokenAuditId:       null,
      errorMessage:             sanitizeErrorMessage(err),
    }
  }

  const durationMs = Date.now() - startMs

  // Persist. Insert failure is logged but not propagated — the verification
  // itself already happened and is reflected in the in-process summary.
  const { data: inserted, error: insertError } = await admin
    .from('audit_chain_health')
    .insert({
      status:                       summary.status,
      rows_checked:                 summary.rowsChecked,
      rows_invalid:                 summary.rowsInvalid,
      first_broken_event_sequence:  summary.firstBrokenEventSequence,
      first_broken_audit_id:        summary.firstBrokenAuditId,
      duration_ms:                  durationMs,
      error_message:                summary.errorMessage,
      triggered_by:                 triggeredBy,
    })
    .select('id')
    .maybeSingle()

  if (insertError) {
    console.error('[audit-chain-health] Failed to record health row:', insertError.message)
  }

  return {
    status:                   summary.status,
    rowsChecked:              summary.rowsChecked,
    rowsInvalid:              summary.rowsInvalid,
    firstBrokenEventSequence: summary.firstBrokenEventSequence,
    firstBrokenAuditId:       summary.firstBrokenAuditId,
    durationMs,
    errorMessage:             summary.errorMessage,
    recordedAs:               inserted?.id ?? null,
  }
}

// ─── Reader (used by admin GET + dashboard) ───────────────────────────────────

/**
 * Returns the most recent N rows from audit_chain_health.
 * Default N = 1 (caller passes 10 for the admin history view).
 *
 * Returns an empty array if the table is empty (chain has never been checked).
 */
export async function getRecentAuditChainHealth(
  limit = 1,
): Promise<AuditChainHealthRow[]> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('audit_chain_health')
    .select(
      'id, checked_at, status, rows_checked, rows_invalid, ' +
      'first_broken_event_sequence, first_broken_audit_id, ' +
      'duration_ms, error_message, triggered_by',
    )
    .order('checked_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[audit-chain-health] Failed to read health rows:', error.message)
    return []
  }
  return (data ?? []) as unknown as AuditChainHealthRow[]
}
