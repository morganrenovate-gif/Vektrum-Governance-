/**
 * POST /api/design-partner-applications
 *
 * Public, unauthenticated endpoint for the /design-partners landing page form.
 *
 * Behaviour:
 *   1. Validates the request body. Invalid input → 400.
 *   2. Inserts a row into design_partner_applications via the service-role
 *      admin client (RLS denies all public access).
 *   3. Insert success returns 200 immediately to the client.
 *   4. Admin alert email is dispatched. If the email succeeds, the row's
 *      admin_email_sent_at is set. If it fails, the application is preserved
 *      and the failure is logged — the visitor still sees success.
 *
 * Anti-abuse:
 *   - Honeypot field `website` must be empty (silently 200 with status:'ok'
 *     to avoid signalling rejection to bots).
 *   - Total payload bounded (~12 KB) and per-field length caps mirror the DB.
 *
 * Never logs secrets or full request bodies — only minimal context for ops.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  sendDesignPartnerAlertEmail,
  type DesignPartnerApplicationContext,
} from '@/lib/email/design-partner-alert'

// ─── Constants ────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'   // Resend SDK requires Node runtime
export const dynamic = 'force-dynamic'

const AUDIENCE_VALUES = new Set([
  'Lender', 'Title / escrow', 'Builder',
  'Developer', 'Fund control', 'Contractor', 'Other',
])

const DRAW_EXPOSURE_VALUES = new Set([
  'Yes', 'No', 'Not directly, but my team does',
])

const MAX_PAYLOAD_BYTES = 12_000  // ~12 KB

// ─── Validation ───────────────────────────────────────────────────────────────

function trimOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function nullableString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

function isValidEmail(s: string): boolean {
  // Conservative — must contain "@", a "." after @, no spaces, length 3..320.
  if (s.length < 3 || s.length > 320) return false
  if (/\s/.test(s)) return false
  const at = s.indexOf('@')
  if (at < 1 || at === s.length - 1) return false
  return s.indexOf('.', at) > at
}

interface ValidatedInput {
  name:                string
  company:             string
  role:                string
  email:               string
  audienceType:        string
  drawExposure:        string
  biggestBottleneck:   string
  utmSource:           string | null
  utmMedium:           string | null
  utmCampaign:         string | null
  utmContent:          string | null
  utmTerm:             string | null
  referrer:            string | null
  userAgent:           string | null
}

type ValidationResult =
  | { ok: true;  data: ValidatedInput }
  | { ok: false; error: string }

function validate(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' }
  }
  const b = body as Record<string, unknown>

  // Honeypot — bots fill any field they see. Real users see no `website` input.
  // We accept the request (return ok) but flag it so the caller can short-circuit.
  if (typeof b.website === 'string' && b.website.trim() !== '') {
    return { ok: false, error: '__honeypot__' }
  }

  const name              = trimOrEmpty(b.name)
  const company           = trimOrEmpty(b.company)
  const role              = trimOrEmpty(b.role)
  const email             = trimOrEmpty(b.email).toLowerCase()
  const audienceType      = trimOrEmpty(b.audienceType)
  const drawExposure      = trimOrEmpty(b.drawExposure)
  const biggestBottleneck = trimOrEmpty(b.biggestBottleneck)

  if (!name)              return { ok: false, error: 'Name is required' }
  if (name.length > 200)  return { ok: false, error: 'Name is too long' }
  if (!company)           return { ok: false, error: 'Company is required' }
  if (company.length > 200) return { ok: false, error: 'Company is too long' }
  if (!role)              return { ok: false, error: 'Role is required' }
  if (role.length > 200)  return { ok: false, error: 'Role is too long' }
  if (!email)             return { ok: false, error: 'Email is required' }
  if (!isValidEmail(email)) return { ok: false, error: 'Email is invalid' }
  if (!audienceType || !AUDIENCE_VALUES.has(audienceType)) {
    return { ok: false, error: 'audienceType is invalid' }
  }
  if (!drawExposure || !DRAW_EXPOSURE_VALUES.has(drawExposure)) {
    return { ok: false, error: 'drawExposure is invalid' }
  }
  if (!biggestBottleneck) return { ok: false, error: 'biggestBottleneck is required' }
  if (biggestBottleneck.length > 2000) {
    return { ok: false, error: 'biggestBottleneck is too long' }
  }

  return {
    ok: true,
    data: {
      name, company, role, email, audienceType, drawExposure, biggestBottleneck,
      utmSource:   nullableString(b.utmSource,   200),
      utmMedium:   nullableString(b.utmMedium,   200),
      utmCampaign: nullableString(b.utmCampaign, 200),
      utmContent:  nullableString(b.utmContent,  200),
      utmTerm:     nullableString(b.utmTerm,     200),
      referrer:    nullableString(b.referrer,    2000),
      userAgent:   nullableString(b.userAgent,   1000),
    },
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Read raw text first so we can enforce a payload cap before JSON parsing.
  let raw: string
  try {
    raw = await req.text()
  } catch {
    return NextResponse.json({ error: 'Could not read body' }, { status: 400 })
  }

  if (raw.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validate(body)
  if (!result.ok) {
    if (result.error === '__honeypot__') {
      // Look like a successful submission to the bot — do not insert, do not email.
      return NextResponse.json({ ok: true, status: 'ok' }, { status: 200 })
    }
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  const v = result.data

  // ── Insert via service role (bypasses RLS) ──────────────────────────────────
  const admin = createSupabaseAdminClient()

  const headerUa = (req.headers.get('user-agent') ?? '').slice(0, 1000)
  const userAgent = v.userAgent ?? (headerUa.length > 0 ? headerUa : null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertError } = await (admin as any)
    .from('design_partner_applications')
    .insert({
      name:               v.name,
      company:            v.company,
      role:               v.role,
      email:              v.email,
      audience_type:      v.audienceType,
      draw_exposure:      v.drawExposure,
      biggest_bottleneck: v.biggestBottleneck,
      utm_source:         v.utmSource,
      utm_medium:         v.utmMedium,
      utm_campaign:       v.utmCampaign,
      utm_content:        v.utmContent,
      utm_term:           v.utmTerm,
      referrer:           v.referrer,
      user_agent:         userAgent,
    })
    .select('id, created_at')
    .single()

  if (insertError || !inserted) {
    // Do not show success — the application would otherwise be silently lost.
    console.error(
      '[design-partner-applications] insert failed:',
      insertError?.message ?? '<unknown>',
    )
    return NextResponse.json(
      { error: 'Could not save your application. Please try again.' },
      { status: 500 },
    )
  }

  // ── Send admin alert (non-blocking for the success response) ──────────────
  // We await the send so we can update admin_email_sent_at on success.
  // Email failure DOES NOT roll back the insert — visitor still sees success.
  const emailCtx: DesignPartnerApplicationContext = {
    id:                inserted.id,
    name:              v.name,
    company:           v.company,
    role:              v.role,
    email:             v.email,
    audienceType:      v.audienceType,
    drawExposure:      v.drawExposure,
    biggestBottleneck: v.biggestBottleneck,
    utmSource:         v.utmSource,
    utmMedium:         v.utmMedium,
    utmCampaign:       v.utmCampaign,
    utmContent:        v.utmContent,
    utmTerm:           v.utmTerm,
    referrer:          v.referrer,
    userAgent:         userAgent,
    submittedAt:       inserted.created_at,
  }

  let emailSent = false
  try {
    emailSent = await sendDesignPartnerAlertEmail(emailCtx)
  } catch (err) {
    console.error(
      '[design-partner-applications] alert send threw (non-fatal):',
      err instanceof Error ? err.message : err,
    )
  }

  if (emailSent) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('design_partner_applications')
        .update({ admin_email_sent_at: new Date().toISOString() })
        .eq('id', inserted.id)
    } catch (err) {
      console.error(
        '[design-partner-applications] failed to mark admin_email_sent_at (non-fatal):',
        err instanceof Error ? err.message : err,
      )
    }
  }

  return NextResponse.json(
    { ok: true, id: inserted.id, emailSent },
    { status: 200 },
  )
}
