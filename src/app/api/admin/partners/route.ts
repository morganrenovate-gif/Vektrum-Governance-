import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { generatePartnerApiKey, generateWebhookSigningSecret } from '@/lib/auth/partner'
import { internalError, validationError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/partners ──────────────────────────────────────────────────
//
// Lists all partners. Returns the prefix and metadata — never the full API key
// or signing secret (those are shown once at creation only).
//
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

  const { data: partners, error } = await admin
    .from('partners')
    .select('id, name, webhook_url, api_key_prefix, is_active, notes, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) {
    return internalError('Failed to fetch partners.', error.message)
  }

  // Augment each partner with their deal count
  const { data: dealCounts } = await admin
    .from('deals')
    .select('partner_id')
    .not('partner_id', 'is', null)

  const countMap: Record<string, number> = {}
  for (const row of dealCounts ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pid = (row as any).partner_id
    countMap[pid] = (countMap[pid] ?? 0) + 1
  }

  type PartnerRow = {
    id: string
    name: string
    webhook_url: string | null
    api_key_prefix: string
    is_active: boolean
    notes: string | null
    created_at: string
    updated_at: string
  }

  return NextResponse.json({
    partners: (partners ?? [] as PartnerRow[]).map((p: PartnerRow) => ({
      ...p,
      deal_count:         countMap[p.id] ?? 0,
      has_webhook:        !!p.webhook_url,
      webhook_url_masked: p.webhook_url
        ? `${new URL(p.webhook_url).origin}/...`
        : null,
    })),
  })
}

// ─── POST /api/admin/partners ─────────────────────────────────────────────────
//
// Creates a new partner and generates a one-time API key + webhook signing
// secret. The full key and signing secret are returned ONCE and never stored.
//
// Request body:
//   {
//     name:         string   (required)
//     webhook_url?: string   (optional — must be https:// if provided)
//     notes?:       string
//   }
//
// Response includes the plaintext API key and signing secret — log them
// somewhere safe immediately. They cannot be recovered after this response.

interface CreatePartnerBody {
  name?:         string
  webhook_url?:  string
  notes?:        string
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

  let body: CreatePartnerBody
  try {
    body = (await request.json()) as CreatePartnerBody
  } catch {
    return validationError(['Request body must be valid JSON.'])
  }

  const name        = typeof body.name        === 'string' ? body.name.trim()        : ''
  const webhookUrl  = typeof body.webhook_url === 'string' ? body.webhook_url.trim() : null
  const notes       = typeof body.notes       === 'string' ? body.notes.trim()       : null

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
  const { fullKey, prefix, hash } = generatePartnerApiKey()
  const webhookSecret             = generateWebhookSigningSecret()

  const admin = createSupabaseAdminClient()

  const { data: partner, error: insertError } = await admin
    .from('partners')
    .insert({
      name,
      webhook_url:            webhookUrl,
      webhook_signing_secret: webhookSecret,
      api_key_hash:           hash,
      api_key_prefix:         prefix,
      is_active:              true,
      notes,
    })
    .select('id, name, webhook_url, api_key_prefix, is_active, notes, created_at')
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
      webhook_url:    webhookUrl,
      api_key_prefix: prefix,
      is_active:      true,
    },
    metadata: {
      has_webhook:  !!webhookUrl,
      created_by:   authContext.user.id,
    },
  })

  return NextResponse.json(
    {
      partner: {
        id:             partner.id,
        name:           partner.name,
        webhook_url:    partner.webhook_url,
        api_key_prefix: partner.api_key_prefix,
        is_active:      partner.is_active,
        notes:          partner.notes,
        created_at:     partner.created_at,
      },
      // ⚠ Shown ONCE — store immediately, cannot be recovered.
      credentials: {
        api_key:                fullKey,
        webhook_signing_secret: webhookSecret,
        warning:
          'Store these credentials immediately. The full API key and webhook signing secret ' +
          'are shown once and cannot be recovered. If lost, rotate via PATCH /api/admin/partners/:id/rotate-key.',
      },
    },
    { status: 201 },
  )
}
