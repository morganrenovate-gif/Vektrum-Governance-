import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// ─── Audit Log Parameters ─────────────────────────────────────────────────────

export interface AuditParams {
  /** The table or domain object this log entry refers to, e.g. 'milestone', 'deal', 'release' */
  entity_type: string
  /** The UUID of the specific record being acted upon */
  entity_id: string
  /** A short, consistent verb describing what happened, e.g. 'status_transitioned', 'funds_released' */
  action: string
  /** The user ID (from auth.users) of who performed the action */
  actor_id: string
  /** Snapshot of the record's relevant fields BEFORE the change. Null for creation events. */
  old_values?: Record<string, unknown> | null
  /** Snapshot of the record's relevant fields AFTER the change. Null for deletion events. */
  new_values?: Record<string, unknown> | null
  /** Arbitrary contextual data — request IDs, Stripe transfer IDs, IP addresses, etc. */
  metadata?: Record<string, unknown> | null
  /** Denormalized role of the actor: 'contractor' | 'funder' | 'admin' | 'system' | null */
  actor_role?: string | null
}

// ─── Logger ───────────────────────────────────────────────────────────────────

/**
 * Writes an immutable audit record to the `audit_log` table using the admin
 * Supabase client (bypasses RLS so audit writes always succeed regardless of
 * the current user's permissions).
 *
 * SAFETY CONTRACT:
 *   This function MUST NEVER THROW. Any failure is caught internally and
 *   printed to console.error. Audit failures must not interrupt business logic.
 *   Callers do not need to wrap this in try/catch.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const adminClient = createSupabaseAdminClient()

    const { error } = await adminClient.from('audit_log').insert({
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      action: params.action,
      actor_id: params.actor_id,
      actor_role: params.actor_role ?? null,
      old_values: params.old_values ?? null,
      new_values: params.new_values ?? null,
      metadata: params.metadata ?? null,
    })

    if (error) {
      console.error('[audit] Failed to write audit log entry:', {
        error,
        params,
      })
    }
  } catch (err) {
    // Never propagate — audit failures are logged but must not block the calling operation
    console.error('[audit] Unexpected error in logAudit:', err, { params })
  }
}
// cache-bust 1776203703
