import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { logAudit, logAdminAudit } from '@/lib/engine/audit'
import { generatePartnerApiKey, generateWebhookSigningSecret } from '@/lib/auth/partner'
import { internalError, notFoundError, validationError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── Shared auth helper ───────────────────────────────────────────────────────

async function adminAuth(request: NextRequest) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return { error: err as NextResponse, authContext: null }
  }
  try {
    requireRole(authContext.profile, 'admin')
  } catch (err) {
    return { error: err as NextResponse, authContext: null }
  }
  const supabase = await createClient()
  try {
    await requireMFA(supabase, authContext.profile)
  } catch (err) {
    return { error: err as NextResponse, authContext: null }
  }
  return { error: null, authContext }
}

// ─── GET /api/admin/partners/[partnerId] ─────────────────────────────────────
//
// Returns a single partner's details, assigned deals, and operational stats.
// Never returns credentials (api_key_hash, webhook_signing_secret).

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { partnerId } = await params
  const { error, authContext } = await adminAuth(request)
  if (error || !authContext) return error!

  const admin = createSupabaseAdminClient()

  const { data: partner, error: fetchError } = await admin
    .from('partners')
    .select(
      'id, name, webhook_url, api_key_prefix, is_active, notes, ' +
      'key_environment, last_used_at, created_at, updated_at',
    )
    .eq('id', partnerId)
    .single()

  if (fetchError || !partner) {
    return notFoundError(`Partner ${partnerId} was not found.`)
  }

  // Assigned deals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deals } = await (admin as any)
    .from('deals')
    .select('id, title, status, execution_rail, funded_amount, released_amount')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ partner, deals: deals ?? [] })
}

// ─── PATCH /api/admin/partners/[partnerId] ────────────────────────────────────
//
// Updates partner name, webhook_url, notes, or is_active status.
// Credential rotation and revocation are sub-actions in the body.
//
// Request body fields (all optional):
//   name?:              string
//   webhook_url?:       string | null   (null removes the webhook)
//   notes?:             string | null
//   is_active?:         boolean
//   action?:            'rotate_key' | 'rotate_secret' | 'revoke'
//   key_environment?:   'test' | 'live'  (for rotate_key, defaults to existing)
//
// Actions:
//   rotate_key    — generates a new API key; old key immediately invalid.
//                   Returns credentials in response (show once).
//   rotate_secret — generates a new webhook signing secret.
//                   Returns credentials in response (show once).
//   revoke        — deactivates the partner (is_active = false) with a
//                   distinct audit action 'partner_key_revoked'. Differs from
//                   is_active=false toggle: signals intentional revocation vs
//                   temporary deactivation in the audit trail.

interface PatchPartnerBody {
  name?:            string
  webhook_url?:     string | null
  notes?:           string | null
  is_active?:       boolean
  action?:          'rotate_key' | 'rotate_secret' | 'revoke'
  key_environment?: string
  /** Required for destructive actions (rotate_key, rotate_secret, revoke). Min 20 chars. */
  justification?:   string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { partnerId } = await params
  const { error, authContext } = await adminAuth(request)
  if (error || !authContext) return error!

  // ── Rate limit — admin write ───────────────────────────────────────────────
  {
    const rl = await checkRateLimit(`user:${authContext.user.id}:admin_write`, POLICIES.admin_write)
    if (!rl.allowed) {
      logRateLimitViolation(`user:${authContext.user.id}:admin_write`, rl, {
        actorId: authContext.user.id, policyName: 'admin_write',
        entityType: 'partner', entityId: partnerId,
      })
      return rateLimitResponse(rl, POLICIES.admin_write.description)
    }
  }

  let body: PatchPartnerBody
  try {
    body = (await request.json()) as PatchPartnerBody
  } catch {
    return validationError(['Request body must be valid JSON.'])
  }

  const admin = createSupabaseAdminClient()

  // Verify partner exists
  const { data: existing, error: fetchError } = await admin
    .from('partners')
    .select('id, name, webhook_url, api_key_prefix, is_active, notes, key_environment')
    .eq('id', partnerId)
    .single()

  if (fetchError || !existing) {
    return notFoundError(`Partner ${partnerId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ex = existing as any

  // ── Justification required for credential operations ──────────────────────
  // rotate_key, rotate_secret, and revoke are logged to admin_audit_log and
  // require a justification of at least 20 characters, matching the pattern
  // used by subscription tier changes and admin audit reviews.
  const DESTRUCTIVE_ACTIONS = ['rotate_key', 'rotate_secret', 'revoke'] as const
  let justification = ''
  if (body.action && (DESTRUCTIVE_ACTIONS as readonly string[]).includes(body.action)) {
    justification = typeof body.justification === 'string' ? body.justification.trim() : ''
    if (justification.length < 20) {
      return validationError([
        'justification is required for credential operations and must be at least 20 characters.',
      ])
    }
  }

  // ── Revoke: hard deactivation with distinct audit action ──────────────────
  if (body.action === 'revoke') {
    if (!ex.is_active) {
      return NextResponse.json(
        { error: 'This partner is already inactive/revoked.' },
        { status: 409 },
      )
    }

    const { data: revoked, error: revokeError } = await admin
      .from('partners')
      .update({ is_active: false })
      .eq('id', partnerId)
      .select('id, name, webhook_url, api_key_prefix, key_environment, is_active, notes, last_used_at, updated_at')
      .single()

    if (revokeError || !revoked) {
      return internalError('Failed to revoke partner.', revokeError?.message)
    }

    await logAdminAudit({
      entity_type:         'partner',
      entity_id:           partnerId,
      action:              'partner_key_revoked',
      actor_id:            authContext.user.id,
      actor_role:          authContext.profile.role,
      system_source:       'api/admin/partners/[partnerId]',
      old_values:          { is_active: true },
      new_values:          { is_active: false },
      admin_justification: justification,
      metadata: {
        partner_name:    ex.name,
        api_key_prefix:  ex.api_key_prefix,
        key_environment: ex.key_environment,
        revoked_by:      authContext.user.id,
      },
    })

    return NextResponse.json({ partner: revoked })
  }

  const errors: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {}

  // ── Field updates ──────────────────────────────────────────────────────────
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) errors.push('name cannot be empty.')
    else if (name.length > 200) errors.push('name must be at most 200 characters.')
    else updates.name = name
  }

  if ('webhook_url' in body) {
    if (body.webhook_url === null || body.webhook_url === '') {
      updates.webhook_url = null
    } else if (typeof body.webhook_url === 'string') {
      try {
        const u = new URL(body.webhook_url)
        if (u.protocol !== 'https:') errors.push('webhook_url must use HTTPS.')
        else updates.webhook_url = body.webhook_url.trim()
      } catch {
        errors.push('webhook_url must be a valid URL.')
      }
    }
  }

  if ('notes' in body) {
    updates.notes = body.notes === null ? null : String(body.notes ?? '').trim() || null
  }

  if (typeof body.is_active === 'boolean') {
    updates.is_active = body.is_active
  }

  if (errors.length > 0) return validationError(errors)

  // ── Credential rotation ────────────────────────────────────────────────────
  let rotatedKey:        string | null = null
  let rotatedKeyEnv:     'test' | 'live' | null = null
  let rotatedSecret:     string | null = null

  if (body.action === 'rotate_key') {
    // Use explicitly requested environment or preserve the existing one
    const targetEnv: 'test' | 'live' =
      body.key_environment === 'test' ? 'test'
      : body.key_environment === 'live' ? 'live'
      : (ex.key_environment as 'test' | 'live' ?? 'live')

    const { fullKey, prefix, hash, keyEnvironment } = generatePartnerApiKey(targetEnv)
    updates.api_key_hash    = hash
    updates.api_key_prefix  = prefix
    updates.key_environment = keyEnvironment
    rotatedKey    = fullKey
    rotatedKeyEnv = keyEnvironment
  }

  if (body.action === 'rotate_secret') {
    const secret = generateWebhookSigningSecret()
    updates.webhook_signing_secret = secret
    rotatedSecret = secret
  }

  if (Object.keys(updates).length === 0 && !body.action) {
    return validationError(['No updatable fields provided.'])
  }

  // ── Apply update ───────────────────────────────────────────────────────────
  const { data: updated, error: updateError } = await admin
    .from('partners')
    .update(updates)
    .eq('id', partnerId)
    .select('id, name, webhook_url, api_key_prefix, key_environment, is_active, notes, last_used_at, updated_at')
    .single()

  if (updateError || !updated) {
    return internalError('Failed to update partner.', updateError?.message)
  }

  // Credential operations (rotate_key, rotate_secret) → logAdminAudit (dual-writes
  // to both audit_log and admin_audit_log with mandatory justification).
  // Non-credential field updates → logAudit (normal audit trail only).
  const auditAction =
    body.action === 'rotate_key'    ? 'partner_key_rotated'
    : body.action === 'rotate_secret' ? 'partner_webhook_secret_rotated'
    : 'partner_updated'

  const auditBase = {
    entity_type:   'partner' as const,
    entity_id:     partnerId,
    action:        auditAction,
    actor_id:      authContext.user.id,
    actor_role:    authContext.profile.role,
    system_source: 'api/admin/partners/[partnerId]',
    old_values: {
      name:            ex.name,
      is_active:       ex.is_active,
      webhook_url:     ex.webhook_url,
      key_environment: ex.key_environment,
    },
    new_values: updates,
    metadata: {
      ...(rotatedKey ? { new_key_prefix: (updated as any).api_key_prefix, key_environment: rotatedKeyEnv } : {}),
    },
  }

  if (body.action === 'rotate_key' || body.action === 'rotate_secret') {
    await logAdminAudit({ ...auditBase, admin_justification: justification })
  } else {
    await logAudit(auditBase)
  }

  const response: Record<string, unknown> = { partner: updated }

  if (rotatedKey) {
    response.credentials = {
      api_key:         rotatedKey,
      key_environment: rotatedKeyEnv,
      warning:
        'New API key shown once — store immediately. ' +
        'The previous key is now invalid.',
    }
  }
  if (rotatedSecret) {
    response.credentials = {
      ...(typeof response.credentials === 'object' && response.credentials !== null
        ? response.credentials
        : {}),
      webhook_signing_secret: rotatedSecret,
      warning:
        'New webhook signing secret shown once — store immediately and ' +
        'update your verification logic before the next webhook delivery.',
    }
  }

  return NextResponse.json(response)
}
