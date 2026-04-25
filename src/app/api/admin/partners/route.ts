import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { generatePartnerApiKey, generateWebhookSigningSecret } from '@/lib/auth/partner'
import { internalError, validationError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/partners ──────────────────────────────────────────────────
//
// Lists all partners with enriched operational stats:
//   - deal_count              : deals assigned to this partner
//   - pending_confirmations   : external releases awaiting confirmation
//   - failed_releases         : external releases that failed
//   - last_used_at            : most recent successful API key auth
//   - key_environment         : 'test' | 'live'
//
// Never returns the api_key_hash, api_key plaintext, or webhook_signing_secret.
// Admin-only, MFA-required.

export async function GET(request: NextRequest) {
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

  const admin = createSupabaseAdminClient()

  // ── Fetch partners ─────────────────────────────────────────────────────────
  const { data: partners, error } = await admin
    .from('partners')
    .select(
      'id, name, webhook_url, api_key_prefix, is_active, notes, ' +
      'key_environment, last_used_at, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    return internalError('Failed to fetch partners.', error.message)
  }

  // ── Deal counts ────────────────────────────────────────────────────────────
  const { data: allDeals } = await admin
    .from('deals')
    .select('id, partner_id')
    .not('partner_id', 'is', null)

  const dealCountMap: Record<string, number> = {}
  const partnerDealIds: Record<string, string[]> = {}

  for (const d of allDeals ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pid = (d as any).partner_id as string
    dealCountMap[pid]  = (dealCountMap[pid] ?? 0) + 1
    partnerDealIds[pid] = [...(partnerDealIds[pid] ?? []), d.id]
  }

  // ── Pending + failed external releases per partner ─────────────────────────
  // Fetch all external-manual releases that are pending or failed,
  // then resolve to partner via their deal's partner_id.
  const allDealIds = Object.values(partnerDealIds).flat()

  const pendingMap: Record<string, number> = {}
  const failedMap:  Record<string, number> = {}

  if (allDealIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: extReleases } = await (admin as any)
      .from('releases')
      .select('deal_id, execution_status')
      .eq('execution_rail', 'external_manual')
      .in('execution_status', ['pending', 'failed'])
      .in('deal_id', allDealIds)

    // Build deal_id → partner_id lookup
    const dealToPartner: Record<string, string> = {}
    for (const [pid, dids] of Object.entries(partnerDealIds)) {
      for (const did of dids) dealToPartner[did] = pid
    }

    for (const r of extReleases ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const release = r as any
      const pid = dealToPartner[release.deal_id]
      if (!pid) continue
      if (release.execution_status === 'pending') {
        pendingMap[pid] = (pendingMap[pid] ?? 0) + 1
      } else if (release.execution_status === 'failed') {
        failedMap[pid]  = (failedMap[pid]  ?? 0) + 1
      }
    }
  }

  type PartnerRow = {
    id: string
    name: string
    webhook_url: string | null
    api_key_prefix: string
    is_active: boolean
    notes: string | null
    key_environment: string
    last_used_at: string | null
    created_at: string
    updated_at: string
  }

  return NextResponse.json({
    partners: (partners ?? [] as PartnerRow[]).map((p: PartnerRow) => ({
      ...p,
      deal_count:             dealCountMap[p.id] ?? 0,
      pending_confirmations:  pendingMap[p.id]  ?? 0,
      failed_releases:        failedMap[p.id]   ?? 0,
      has_webhook:            !!p.webhook_url,
      webhook_url_masked:     p.webhook_url
        ? `${new URL(p.webhook_url).origin}/...`
        : null,
    })),
  })
}

// ─── POST /api/admin/partners ─────────────────────────────────────────────────
//
// Creates a new partner with generated API key and webhook signing secret.
// The full key and signing secret are returned ONCE and never stored.
//
// Request body:
//   {
//     name:              string             (required)
//     key_environment?:  'test' | 'live'    (default: 'live')
//     webhook_url?:      string             (must be https:// if provided)
//     notes?:            string
//   }
//
// ⚠  The credentials block in the response must be stored immediately.
//    It cannot be recovered after this response.

interface CreatePartnerBody {
  name?:            string
  key_environment?: string
  webhook_url?:     string
  notes?:           string
}

export async function POST(request: NextRequest) {
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

  // ── Rate limit — admin write ───────────────────────────────────────────────
  {
    const rl = await checkRateLimit(`user:${authContext.user.id}:admin_write`, POLICIES.admin_write)
    if (!rl.allowed) {
      logRateLimitViolation(`user:${authContext.user.id}:admin_write`, rl, {
        actorId: authContext.user.id, policyName: 'admin_write',
        entityType: 'partner', entityId: 'new',
      })
      return rateLimitResponse(rl, POLICIES.admin_write.description)
    }
  }

  let body: CreatePartnerBody
  try {
    body = (await request.json()) as CreatePartnerBody
  } catch {
    return validationError(['Request body must be valid JSON.'])
  }

  const name        = typeof body.name        === 'string' ? body.name.trim()        : ''
  const webhookUrl  = typeof body.webhook_url === 'string' ? body.webhook_url.trim() : null
  const notes       = typeof body.notes       === 'string' ? body.notes.trim()       : null
  const keyEnv      = body.key_environment === 'test' ? 'test' : 'live'

  const errors: string[] = []

  if (!name) {
    errors.push('name is required.')
  } else if (name.length > 200) {
    errors.push('name must be at most 200 characters.')
  }

  if (webhookUrl) {
    try {
      const u = new URL(webhookUrl)
      if (u.protocol !== 'https:') {
        errors.push('webhook_url must use HTTPS.')
      }
    } catch {
      errors.push('webhook_url must be a valid URL.')
    }
  }

  if (errors.length > 0) return validationError(errors)

  // ── Generate credentials ───────────────────────────────────────────────────
  const { fullKey, prefix, hash, keyEnvironment } = generatePartnerApiKey(keyEnv)
  const webhookSecret = generateWebhookSigningSecret()

  const admin = createSupabaseAdminClient()

  const { data: partner, error: insertError } = await admin
    .from('partners')
    .insert({
      name,
      webhook_url:            webhookUrl,
      webhook_signing_secret: webhookSecret,
      api_key_hash:           hash,
      api_key_prefix:         prefix,
      key_environment:        keyEnvironment,
      is_active:              true,
      notes,
    })
    .select('id, name, webhook_url, api_key_prefix, key_environment, is_active, notes, created_at')
    .single()

  if (insertError || !partner) {
    return internalError('Failed to create partner.', insertError?.message)
  }

  await logAudit({
    entity_type:   'partner',
    entity_id:     partner.id,
    action:        'partner_created',
    actor_id:      authContext.user.id,
    actor_role:    authContext.profile.role,
    system_source: 'api/admin/partners',
    new_values: {
      name,
      webhook_url:     webhookUrl,
      api_key_prefix:  prefix,
      key_environment: keyEnvironment,
      is_active:       true,
    },
    metadata: {
      has_webhook:  !!webhookUrl,
      created_by:   authContext.user.id,
      key_environment: keyEnvironment,
    },
  })

  return NextResponse.json(
    {
      partner: {
        id:              partner.id,
        name:            partner.name,
        webhook_url:     partner.webhook_url,
        api_key_prefix:  partner.api_key_prefix,
        key_environment: partner.key_environment,
        is_active:       partner.is_active,
        notes:           partner.notes,
        created_at:      partner.created_at,
      },
      // ⚠ Shown ONCE — store immediately, cannot be recovered.
      credentials: {
        api_key:                fullKey,
        webhook_signing_secret: webhookSecret,
        warning:
          'Store these credentials immediately. The full API key and webhook ' +
          'signing secret are shown once and cannot be recovered. ' +
          'If lost, rotate via PATCH /api/admin/partners/:id with action=rotate_key.',
      },
    },
    { status: 201 },
  )
}
