import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/engine/audit'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ─── POST /api/auth/webhook ───────────────────────────────────────────────────
//
// Receives auth lifecycle events from Supabase Database Webhooks.
//
// SETUP (Supabase Dashboard → Database → Webhooks):
//   Table:    auth.users
//   Events:   INSERT, UPDATE
//   URL:      https://<your-domain>/api/auth/webhook
//   HTTP method: POST
//   Secret:   set SUPABASE_AUTH_WEBHOOK_SECRET and configure as the webhook
//             Authorization bearer secret in the Supabase dashboard.
//
// EVENTS HANDLED:
//   INSERT on auth.users  → user_signup         (handled by DB trigger already,
//                                                 but logged here for webhook completeness)
//   UPDATE on auth.users where last_sign_in_at changes → auth_signin
//   UPDATE on auth.users where email_change_token_new is set → auth_email_change
//   UPDATE on auth.users where password recovery fields change → auth_password_reset_requested
//
// PAYLOAD (Supabase Database Webhook format):
//   {
//     "type":       "INSERT" | "UPDATE" | "DELETE",
//     "table":      "users",
//     "schema":     "auth",
//     "record":     { "id": "...", "email": "...", "last_sign_in_at": "...", ... },
//     "old_record": { ... } | null
//   }
//
// SECURITY:
//   Requests are authenticated via bearer token compared to
//   SUPABASE_AUTH_WEBHOOK_SECRET. Without this env var set, auth events are
//   still logged (fail-open) but a warning is emitted.
//
// AUTH EVENT LOGGING STRATEGY:
//   Actual sign-in events are NOT logged in getAuthUser() because that function
//   is called on every API request (not just sign-in). Logging there would
//   produce hundreds of 'user_login' entries per session, polluting the audit
//   trail and degrading performance with an extra DB write per API call.
//
//   Instead, this webhook handler captures the exact moments Supabase
//   transitions auth state, giving a precise and low-noise audit trail.

interface SupabaseWebhookPayload {
  type:       'INSERT' | 'UPDATE' | 'DELETE'
  table:      string
  schema:     string
  record:     AuthUserRecord | null
  old_record: AuthUserRecord | null
}

interface AuthUserRecord {
  id:                          string
  email:                       string | null
  phone:                       string | null
  created_at:                  string | null
  updated_at:                  string | null
  last_sign_in_at:             string | null
  email_confirmed_at:          string | null
  phone_confirmed_at:          string | null
  recovery_token:              string | null
  recovery_sent_at:            string | null
  email_change_token_new:      string | null
  email_change_token_current:  string | null
  raw_app_meta_data:           Record<string, unknown> | null
  raw_user_meta_data:          Record<string, unknown> | null
  is_sso_user:                 boolean | null
  banned_until:                string | null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Verify webhook secret ────────────────────────────────────────────────
  const webhookSecret = process.env.SUPABASE_AUTH_WEBHOOK_SECRET

  if (webhookSecret) {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token || token !== webhookSecret) {
      console.warn('[auth-webhook] Unauthorized request — bad or missing bearer token')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    // Warn but allow in development — require it in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[auth-webhook] SUPABASE_AUTH_WEBHOOK_SECRET not set in production — rejecting')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }
    console.warn('[auth-webhook] SUPABASE_AUTH_WEBHOOK_SECRET not set — accepting without verification (dev only)')
  }

  // ── 2. Parse payload ────────────────────────────────────────────────────────
  let payload: SupabaseWebhookPayload
  try {
    payload = await request.json() as SupabaseWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { type, schema, table, record, old_record } = payload

  // Only handle auth.users events
  if (schema !== 'auth' || table !== 'users') {
    return NextResponse.json({ received: true, handled: false, reason: 'not auth.users' })
  }

  if (!record) {
    return NextResponse.json({ received: true, handled: false, reason: 'null record' })
  }

  const userId = record.id

  // ── 3. Route to handler based on event type and changed fields ──────────────
  try {
    if (type === 'INSERT') {
      // User signed up — DB trigger audit_user_signup already logs this from the
      // PostgreSQL side. We log a second application-layer event with richer context.
      await logAuthEvent({
        action:      'auth_signup',
        userId,
        userEmail:   record.email ?? null,
        metadata: {
          provider:     record.raw_app_meta_data?.provider ?? 'email',
          is_sso_user:  record.is_sso_user ?? false,
        },
        note: 'New auth.users row created',
      })
    } else if (type === 'UPDATE' && old_record) {
      // ── Sign-in: last_sign_in_at changed ─────────────────────────────────
      if (record.last_sign_in_at !== old_record.last_sign_in_at && record.last_sign_in_at) {
        await logAuthEvent({
          action:    'auth_signin',
          userId,
          userEmail: record.email ?? null,
          metadata: {
            provider:        record.raw_app_meta_data?.provider ?? 'email',
            sign_in_at:      record.last_sign_in_at,
            is_sso_user:     record.is_sso_user ?? false,
          },
          note: 'last_sign_in_at updated on auth.users',
        })
      }

      // ── Password recovery requested: recovery_sent_at changed ────────────
      if (
        record.recovery_sent_at !== old_record.recovery_sent_at &&
        record.recovery_sent_at
      ) {
        await logAuthEvent({
          action:    'auth_password_reset_requested',
          userId,
          userEmail: record.email ?? null,
          metadata: {
            recovery_sent_at: record.recovery_sent_at,
          },
          note: 'Password recovery email sent',
        })
      }

      // ── Password changed: recovery_token cleared after use ─────────────────
      // When a user completes a password reset, recovery_token goes from
      // a non-null token → null (token consumed).
      if (
        old_record.recovery_token &&
        !record.recovery_token &&
        record.updated_at !== old_record.updated_at
      ) {
        await logAuthEvent({
          action:    'auth_password_changed',
          userId,
          userEmail: record.email ?? null,
          metadata: {
            changed_at: record.updated_at,
          },
          note: 'Recovery token consumed — password changed',
        })
      }

      // ── Email change requested ─────────────────────────────────────────────
      if (
        record.email_change_token_new &&
        record.email_change_token_new !== old_record.email_change_token_new
      ) {
        await logAuthEvent({
          action:    'auth_email_change_requested',
          userId,
          userEmail: record.email ?? null,
          metadata: {
            has_change_token: true,
          },
          note: 'Email change token issued',
        })
      }

      // ── Email change confirmed: email_change_token_new cleared ────────────
      if (
        old_record.email_change_token_new &&
        !record.email_change_token_new &&
        record.email !== old_record.email
      ) {
        await logAuthEvent({
          action:    'auth_email_changed',
          userId,
          userEmail: record.email ?? null,
          metadata: {
            previous_email: old_record.email,
            new_email:      record.email,
            changed_at:     record.updated_at,
          },
          note: 'Email successfully changed',
        })
      }

      // ── Account banned ─────────────────────────────────────────────────────
      if (!old_record.banned_until && record.banned_until) {
        await logAuthEvent({
          action:    'auth_account_banned',
          userId,
          userEmail: record.email ?? null,
          metadata:  { banned_until: record.banned_until },
          note:      'Account banned by admin',
        })
      }
    }
  } catch (err) {
    // Log failure but return 200 — Supabase retries on non-2xx, creating duplicates
    console.error('[auth-webhook] Failed to log auth event:', {
      type,
      userId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({ received: true })
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function logAuthEvent({
  action,
  userId,
  userEmail,
  metadata,
  note,
}: {
  action:     string
  userId:     string
  userEmail:  string | null
  metadata:   Record<string, unknown>
  note:       string
}): Promise<void> {
  // Resolve profile for actor_name + role (best-effort — missing profile is non-fatal)
  const adminClient = createSupabaseAdminClient()
  let actorName: string | null = null
  let actorRole: string | null = null

  try {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, company_name, role')
      .eq('id', userId)
      .single()

    if (profile) {
      actorName = profile.full_name ?? profile.company_name ?? userId
      actorRole = profile.role ?? null
    }
  } catch {
    // Profile lookup failure is non-fatal — continue with null name/role
    actorName = userId
  }

  await logAudit({
    entity_type:   'profile',
    entity_id:     userId,
    action,
    actor_id:      userId,
    actor_name:    actorName,
    actor_email:   userEmail,
    actor_role:    actorRole ?? 'system',
    system_source: 'webhook/supabase_auth',
    new_values:    null,
    old_values:    null,
    metadata: {
      ...metadata,
      _note: note,
    },
  })

  console.info(`[auth-webhook] Logged ${action} for user ${userId}`)
}
