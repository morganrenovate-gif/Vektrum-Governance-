import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
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
// Returns a single partner's details (no credentials).

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
    .select('id, name, webhook_url, api_key_prefix, is_active, notes, created_at, updated_at')
    .eq('id', partnerId)
    .single()

  if (fetchError || !partner) {
    return notFoundError(`Partner ${partnerId} was not found.`)
  }

  // Deal summary for this partner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deals } = await (admin as any)
    .from('deals')
    .select('id, title, status, funded_amount, released_amount')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ partner, deals: deals ?? [] })
}

// ─── PATCH /api/admin/partners/[partnerId] ────────────────────────────────────
//
// Updates partner name, webhook_url, notes, or is_active status.
// Rotation of credentials is handled by separate sub-actions in the body
// (action: 'rotate_key' | 'rotate_secret').
//
// Request body fields (all optional):
//   name?:          string
//   webhook_url?:   string | null   (null removes the webhook)
//   notes?:         string | null
//   is_active?:     boolean
//   action?:        'rotate_key' | 'rotate_secret'

interface PatchPartnerBody {
  name?:         string
  webhook_url?:  string | null
  notes?:        string | null
  is_active?:    boolean
  action?:       'rotate_key' | 'rotate_secret'
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
    .select('id, name, webhook_url, api_key_prefix, is_active, notes')
    .eq('id', partnerId)
    .single()

  if (fetchError || !existing) {
    return notFoundError(`Partner ${partnerId} was not found.`)
  }

  const errors: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newCredentials: Record<string, any> | null = null

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
  let rotatedKey: string | null    = null
  let rotatedSecret: string | null = null

  if (body.action === 'rotate_key') {
    const { fullKey, prefix, hash } = generatePartnerApiKey()
    updates.api_key_hash   = hash
    updates.api_key_prefix = prefix
    rotatedKey = fullKey
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
    .select('id, name, webhook_url, api_key_prefix, is_active, notes, updated_at')
    .single()

  if (updateError || !updated) {
    return internalError('Failed to update partner.', updateError?.message)
  }

  await logAudit({
    entity_type:   'partner',
    entity_id:     partnerId,
    action:        body.action === 'rotate_key'    ? 'partner_key_rotated'
                 : body.action === 'rotate_secret' ? 'partner_webhook_secret_rotated'
                 : 'partner_updated',
    actor_id:      authContext.user.id,
    actor_role:    authContext.profile.role,
    system_source: 'api/admin/partners/[partnerId]',
    old_values: {
      name:       existing.name,
      is_active:  existing.is_active,
      webhook_url: existing.webhook_url,
    },
    new_values: updates,
  })

  const response: Record<string, unknown> = { partner: updated }

  if (rotatedKey) {
    response.credentials = {
      api_key: rotatedKey,
      warning: 'New API key shown once — store immediately. The previous key is now invalid.',
    }
  }
  if (rotatedSecret) {
    response.credentials = {
      ...(response.credentials as object ?? {}),
      webhook_signing_secret: rotatedSecret,
      warning: 'New webhook signing secret shown once — store immediately and update your verification logic.',
    }
  }
  if (newCredentials) {
    response.credentials = newCredentials
  }

  return NextResponse.json(response)
}
