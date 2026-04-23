import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// ─── Audit Log Parameters ─────────────────────────────────────────────────────

export interface AuditParams {
  /** The table or domain object this log entry refers to, e.g. 'milestone', 'deal', 'release' */
  entity_type: string
  /** The UUID of the specific record being acted upon */
  entity_id: string
  /** A short, consistent verb describing what happened, e.g. 'status_transitioned', 'funds_released' */
  action: string
  /** The user ID (from auth.users) of who performed the action. Pass null for system/trigger events. */
  actor_id: string | null
  /** Snapshot of the record's relevant fields BEFORE the change. Null for creation events. */
  old_values?: Record<string, unknown> | null
  /** Snapshot of the record's relevant fields AFTER the change. Null for deletion events. */
  new_values?: Record<string, unknown> | null
  /** Arbitrary contextual data — request IDs, Stripe transfer IDs, IP addresses, etc. */
  metadata?: Record<string, unknown> | null
  /** Denormalized role of the actor: 'contractor' | 'funder' | 'admin' | 'system' | null */
  actor_role?: string | null

  // ── Compliance fields (migration 016) ────────────────────────────────────

  /**
   * Display name of the actor, denormalized at write time.
   * When omitted and actor_id is provided, logAudit will look up the profile.
   * For system events, pass 'system' or leave undefined.
   */
  actor_name?: string | null

  /**
   * Email of the actor from auth.users, denormalized at write time.
   * Must be passed by the caller — logAudit does NOT fetch it automatically
   * (avoids an extra round-trip on every write; callers that have the auth
   * context should provide it).
   */
  actor_email?: string | null

  /**
   * The code module or endpoint that generated this event.
   * Format: 'api/milestones/release', 'webhook/stripe', 'api/disputes', etc.
   * Used to trace an event back to its exact origin without log-grepping.
   */
  system_source?: string | null

  /**
   * Optional request/correlation ID for grouping all events from one HTTP
   * request. Pass crypto.randomUUID() once per request and thread it through.
   */
  session_id?: string | null

  /**
   * Client IP address from x-forwarded-for header, if available.
   * Null for system/trigger events.
   */
  ip_address?: string | null
}

// ─── Logger ───────────────────────────────────────────────────────────────────

/**
 * Writes an immutable audit record to the `audit_log` table using the admin
 * Supabase client (bypasses RLS so audit writes always succeed regardless of
 * the current user's permissions).
 *
 * COMPLIANCE CONTRACT:
 *   Every audit record written by this function is:
 *     - Timestamped server-side (created_at DEFAULT now() in PostgreSQL)
 *     - Assigned a monotonic event_sequence (DEFAULT nextval) at the DB layer
 *     - Blocked from future-dating by a CHECK constraint (max +5 min skew)
 *     - Append-only (no UPDATE/DELETE RLS policies exist on audit_log)
 *     - Self-contained: actor_name is denormalized so the record remains
 *       accurate even if the profile is later deleted
 *
 * SAFETY CONTRACT:
 *   This function MUST NEVER THROW. Any failure is caught internally and
 *   printed to console.error. Audit failures must not interrupt business logic.
 *   Callers do not need to wrap this in try/catch.
 *
 * ACTOR NAME RESOLUTION:
 *   If actor_name is not provided and actor_id is set, this function will
 *   attempt a single profiles lookup to resolve the display name. This adds
 *   one DB round-trip but ensures records are always self-contained.
 *   Pass actor_name explicitly to skip the lookup when performance matters.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const adminClient = createSupabaseAdminClient()

    // ── Resolve actor_name if not provided ──────────────────────────────────
    let resolvedActorName = params.actor_name ?? null

    if (resolvedActorName === null && params.actor_id) {
      try {
        const { data: profile } = await adminClient
          .from('profiles')
          .select('full_name, company_name')
          .eq('id', params.actor_id)
          .single()

        if (profile) {
          resolvedActorName = profile.full_name ?? profile.company_name ?? params.actor_id
        }
      } catch {
        // Name resolution is best-effort — fallback to actor_id string
        resolvedActorName = params.actor_id
      }
    }

    // System events with no actor get 'system' as actor_name
    if (resolvedActorName === null && !params.actor_id) {
      resolvedActorName = 'system'
    }

    // ── Write record ────────────────────────────────────────────────────────
    // event_sequence and created_at are assigned by the DB (DEFAULT nextval /
    // DEFAULT now()) — never passed from the application to prevent tampering.
    const { error } = await adminClient.from('audit_log').insert({
      entity_type:   params.entity_type,
      entity_id:     params.entity_id,
      action:        params.action,
      actor_id:      params.actor_id ?? null,
      actor_role:    params.actor_role ?? null,
      actor_name:    resolvedActorName,
      actor_email:   params.actor_email ?? null,
      system_source: params.system_source ?? null,
      session_id:    params.session_id   ?? null,
      ip_address:    params.ip_address   ?? null,
      old_values:    params.old_values   ?? null,
      new_values:    params.new_values   ?? null,
      metadata:      params.metadata     ?? null,
      // created_at and event_sequence are intentionally omitted —
      // PostgreSQL assigns them server-side to prevent clock manipulation.
    })

    if (error) {
      console.error('[audit] Failed to write audit log entry:', {
        error,
        action:  params.action,
        entity:  `${params.entity_type}/${params.entity_id}`,
        actor:   params.actor_id,
        source:  params.system_source,
      })
    }
  } catch (err) {
    // Never propagate — audit failures are logged but must not block the calling operation
    console.error('[audit] Unexpected error in logAudit:', err, {
      action:  params.action,
      entity:  `${params.entity_type}/${params.entity_id}`,
    })
  }
}

// ─── Audit Chain Verification ────────────────────────────────────────────────

/**
 * A single row's chain verification result.
 */
export interface AuditChainRow {
  auditId:            string
  eventSequence:      number
  rowHashValid:       boolean
  chainHashValid:     boolean
  storedRowHash:      string
  computedRowHash:    string
  storedChainHash:    string
  expectedChainHash:  string
}

/**
 * Overall result of a chain verification pass.
 */
export interface AuditChainVerification {
  /** True only when every checked row has both row_hash_valid and chain_hash_valid. */
  valid:              boolean
  checkedCount:       number
  invalidCount:       number
  /** All rows with row_hash_valid = false or chain_hash_valid = false. */
  brokenRows:         AuditChainRow[]
  /** All rows checked. Only populated when includeAll = true. */
  allRows?:           AuditChainRow[]
  error?:             string
}

/**
 * Verifies the cryptographic hash chain for all hashed audit_log rows for a
 * given entity (deal, milestone, etc.).
 *
 * Calls the Postgres verify_audit_chain() function (added in migration
 * 20260424000004) which re-computes SHA-256 hashes server-side and compares
 * against stored values. This avoids JavaScript/PostgreSQL JSONB serialization
 * mismatches — the hashes are always verified in the same environment they were
 * created.
 *
 * Only rows with row_hash IS NOT NULL are checked (pre-migration rows are
 * excluded). A chain with zero hashed rows returns valid = true with
 * checkedCount = 0.
 *
 * @param entityType   The entity_type to filter by (e.g., 'deal', 'milestone')
 * @param entityId     The entity UUID
 * @param includeAll   If true, all rows are included in the result (not just broken)
 */
export async function verifyAuditChain(
  entityType: string,
  entityId:   string,
  includeAll  = false,
): Promise<AuditChainVerification> {
  try {
    const adminClient = createSupabaseAdminClient()

    const { data: rows, error } = await adminClient.rpc(
      'verify_audit_chain',
      { p_entity_type: entityType, p_entity_id: entityId },
    )

    if (error) {
      console.error('[audit] verifyAuditChain RPC failed:', {
        entityType,
        entityId,
        error: error.message,
      })
      return {
        valid:         false,
        checkedCount:  0,
        invalidCount:  0,
        brokenRows:    [],
        error:         error.message,
      }
    }

    const typedRows: AuditChainRow[] = (rows ?? []).map(
      (r: {
        audit_id: string
        event_seq: number
        row_hash_valid: boolean
        chain_hash_valid: boolean
        stored_row_hash: string
        computed_row_hash: string
        stored_chain_hash: string
        expected_chain_hash: string
      }) => ({
        auditId:           r.audit_id,
        eventSequence:     r.event_seq,
        rowHashValid:      r.row_hash_valid,
        chainHashValid:    r.chain_hash_valid,
        storedRowHash:     r.stored_row_hash,
        computedRowHash:   r.computed_row_hash,
        storedChainHash:   r.stored_chain_hash,
        expectedChainHash: r.expected_chain_hash,
      }),
    )

    const brokenRows = typedRows.filter(r => !r.rowHashValid || !r.chainHashValid)

    return {
      valid:        brokenRows.length === 0,
      checkedCount: typedRows.length,
      invalidCount: brokenRows.length,
      brokenRows,
      allRows:      includeAll ? typedRows : undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[audit] verifyAuditChain unexpected error:', { entityType, entityId, error: message })
    return {
      valid:        false,
      checkedCount: 0,
      invalidCount: 0,
      brokenRows:   [],
      error:        message,
    }
  }
}

// ─── UTC Timestamp Formatter ──────────────────────────────────────────────────

/**
 * Formats an ISO 8601 timestamp as an exact UTC string suitable for
 * legally-defensible audit records and compliance exports.
 *
 * Output format: "YYYY-MM-DD HH:MM:SS UTC"
 * Example:        "2026-04-23 14:35:02 UTC"
 *
 * Pure function — no browser or timezone dependency. Safe for SSR.
 * Never shows relative time ("3 days ago") — always absolute and unambiguous.
 */
export function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso // Return raw string if unparseable

  const pad = (n: number): string => String(n).padStart(2, '0')

  const yyyy = d.getUTCFullYear()
  const mm   = pad(d.getUTCMonth() + 1)
  const dd   = pad(d.getUTCDate())
  const hh   = pad(d.getUTCHours())
  const min  = pad(d.getUTCMinutes())
  const ss   = pad(d.getUTCSeconds())

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC`
}

/**
 * Formats an ISO timestamp as a short UTC date for compact displays.
 * Output: "2026-04-23"
 */
export function formatAuditDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso

  const pad  = (n: number): string => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/**
 * Formats an ISO timestamp as a short UTC time for compact displays.
 * Output: "14:35:02 UTC"
 */
export function formatAuditTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso

  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
}
