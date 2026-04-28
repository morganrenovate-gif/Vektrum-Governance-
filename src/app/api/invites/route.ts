import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/engine/audit'
import {
  conflictError,
  errorResponse,
  internalError,
  notFoundError,
  validationError,
} from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── URL builder ──────────────────────────────────────────────────────────────
// Always derives the base URL from env vars — never from the request origin,
// which is unstable (localhost in dev, internal Vercel proxy URL in prod).
//
// Required env: NEXT_PUBLIC_APP_URL  (e.g. https://app.vektrum.io)
//   Fallback:   APP_URL              (server-only equivalent)
//
// Generated URL format: ${appUrl}/invite/${token}
// The invite page route is /invite/[token] — the path segment IS the token UUID.
// No slug, no query string.

function buildInviteUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL

  if (!appUrl) {
    throw new Error(
      '[buildInviteUrl] Neither NEXT_PUBLIC_APP_URL nor APP_URL is set. ' +
      'Set one of these environment variables to the canonical app URL (e.g. https://app.vektrum.io).',
    )
  }

  // Strip trailing slash so we never produce double-slashes
  return `${appUrl.replace(/\/$/, '')}/invite/${token}`
}

// ─── POST /api/invites ────────────────────────────────────────────────────────
// Generate a secure, single-use funder invite link for a deal.
//
// Security model:
//   - Caller must be authenticated as a contractor
//   - Caller must own the specified deal
//   - Only one PENDING invite per deal — any existing pending invite is expired
//     before the new one is created (guarantees fresh token each time)
//   - Token is generated server-side by the DB (gen_random_uuid()) — never client-supplied
//   - Token is single-use and expires in 7 days
//
// Body: { deal_id, invited_email? }
// Returns: { invite_url, email_sent, invite: { id, token, deal_id, expires_at, ... } }

export async function POST(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'contractor')
  } catch (err) {
    return err as NextResponse
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { deal_id?: string; invited_email?: string }
  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'Request body could not be parsed as JSON. Send: { deal_id, invited_email? }',
    )
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  const errors: string[] = []

  if (!body.deal_id || typeof body.deal_id !== 'string') {
    errors.push('deal_id is required and must be a UUID string.')
  }

  if (
    body.invited_email !== undefined &&
    body.invited_email !== null &&
    typeof body.invited_email === 'string' &&
    body.invited_email.trim() !== '' &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.invited_email.trim())
  ) {
    errors.push('invited_email must be a valid email address if provided.')
  }

  if (errors.length > 0) return validationError(errors)

  const dealId = body.deal_id!.trim()
  const invitedEmail = body.invited_email?.trim() || null

  const admin = createSupabaseAdminClient()

  // ── Verify deal exists and caller is the contractor ────────────────────────
  const { data: deal, error: dealError } = await admin
    .from('deals')
    .select('id, title, status, contractor_id, funder_id')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(
      `Deal ${dealId} was not found. Verify the deal ID and try again.`,
    )
  }

  if (deal.contractor_id !== user.id) {
    return errorResponse(
      403,
      'You are not the contractor on this deal. Only the contractor who created the deal can generate invite links.',
    )
  }

  if (deal.funder_id) {
    return conflictError(
      'This deal already has a funder assigned. Invite links are only needed for deals without a funder.',
    )
  }

  if (deal.status !== 'draft') {
    return errorResponse(
      400,
      `Funder invites can only be generated for deals in 'draft' status. This deal is currently '${deal.status}'.`,
    )
  }

  // ── Invalidate any existing pending invite ─────────────────────────────────
  // We expire the old invite before creating a new one so there is never more
  // than one valid link in circulation. This ensures a regenerated invite
  // always produces a fresh, unguessable token — the old link stops working
  // immediately.
  const { data: existingInvite } = await admin
    .from('deal_invites')
    .select('id')
    .eq('deal_id', dealId)
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    await admin
      .from('deal_invites')
      .update({ status: 'expired' })
      .eq('id', existingInvite.id)
  }

  // ── Create invite ──────────────────────────────────────────────────────────
  // token and expires_at are set by DB defaults (gen_random_uuid(), now()+7d).
  // We never supply a token from the application layer.
  const { data: invite, error: insertError } = await admin
    .from('deal_invites')
    .insert({
      deal_id: dealId,
      invited_by: user.id,
      invited_email: invitedEmail,
      status: 'pending',
    })
    .select('id, token, deal_id, invited_email, status, expires_at, created_at')
    .single()

  if (insertError || !invite) {
    return internalError(
      'Failed to create the invite link. Please try again.',
      insertError?.message,
    )
  }

  // ── Build the invite URL ───────────────────────────────────────────────────
  let inviteUrl: string
  try {
    inviteUrl = buildInviteUrl(invite.token)
  } catch (err) {
    console.error('[invites] URL build failed:', err)
    return internalError(
      'Invite was created but the invite URL could not be generated. ' +
      'Contact support — NEXT_PUBLIC_APP_URL may not be configured.',
    )
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'deal',
    entity_id: dealId,
    action: 'invite_created',
    actor_id: user.id,
    old_values: null,
    new_values: {
      invite_id: invite.id,
      invited_email: invitedEmail,
      expires_at: invite.expires_at,
    },
  })

  // ── Send invite email (non-blocking) ──────────────────────────────────────
  // The invite record already exists regardless of email outcome. If email
  // fails, the contractor can copy-paste the link from the response.
  let emailSent = false

  if (invitedEmail) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const from = process.env.EMAIL_FROM ?? 'Vektrum <invites@vektrum.io>'

      const expiryDate = new Date(invite.expires_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })

      const { error: emailError } = await resend.emails.send({
        from,
        to: invitedEmail,
        subject: `You've been invited to fund "${deal.title}" on Vektrum`,
        html: `
          <p>Hi,</p>
          <p>You've been invited to join <strong>${deal.title}</strong> as a funder on Vektrum — release-control infrastructure for construction disbursements.</p>
          <p>Click the link below to review the deal and accept your invitation:</p>
          <p style="margin:20px 0">
            <a href="${inviteUrl}" style="color:#1A3A96;font-weight:bold;font-size:16px">${inviteUrl}</a>
          </p>
          <p style="color:#6B7280;font-size:13px">This link expires on <strong>${expiryDate}</strong>. It is single-use — once accepted, it cannot be reused.</p>
          <p style="color:#6B7280;font-size:13px">If you were not expecting this invitation, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0" />
          <p style="color:#9CA3AF;font-size:12px">Vektrum · Release-control infrastructure for construction disbursements.</p>
          <p style="color:#9CA3AF;font-size:12px">Vektrum does not hold funds, act as escrow, or move money directly.</p>
        `,
      })

      if (emailError) {
        console.error('[invites] email send failed:', emailError)
      } else {
        emailSent = true
      }
    } catch (err) {
      console.error('[invites] email send threw:', err)
    }
  }

  return NextResponse.json(
    {
      invite_url: inviteUrl,
      email_sent: emailSent,
      invite: {
        id: invite.id,
        token: invite.token,
        deal_id: invite.deal_id,
        invited_email: invite.invited_email,
        status: invite.status,
        expires_at: invite.expires_at,
        created_at: invite.created_at,
      },
    },
    { status: 201 },
  )
}

// ─── GET /api/invites?deal_id=xxx ─────────────────────────────────────────────
// Returns invite history for a deal (contractor or admin only).
// Active invites include the current invite_url.

export async function GET(request: NextRequest) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'contractor', 'admin')
  } catch (err) {
    return err as NextResponse
  }

  const dealId = request.nextUrl.searchParams.get('deal_id')
  if (!dealId) {
    return errorResponse(400, 'deal_id query parameter is required.')
  }

  const admin = createSupabaseAdminClient()

  // Verify contractor owns this deal (admin bypasses)
  if (profile.role !== 'admin') {
    const { data: deal } = await admin
      .from('deals')
      .select('contractor_id')
      .eq('id', dealId)
      .single()

    if (!deal || deal.contractor_id !== user.id) {
      return errorResponse(403, 'You are not the contractor on this deal.')
    }
  }

  const { data: invites, error } = await admin
    .from('deal_invites')
    .select('id, token, deal_id, invited_email, status, expires_at, accepted_by, accepted_at, created_at')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })

  if (error) {
    return internalError('Failed to retrieve invites.', error.message)
  }

  // Only active (pending, non-expired) invites get an invite_url
  const invitesWithUrls = (invites ?? []).map((inv) => {
    let inviteUrl: string | null = null
    if (inv.status === 'pending') {
      try {
        inviteUrl = buildInviteUrl(inv.token)
      } catch {
        // URL build failed (missing env) — return null, don't crash the GET
        inviteUrl = null
      }
    }
    return { ...inv, invite_url: inviteUrl }
  })

  return NextResponse.json({ invites: invitesWithUrls })
}
