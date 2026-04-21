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

// ─── POST /api/invites ────────────────────────────────────────────────────────
// Generate a secure funder invite link for a deal.
//
// Security model:
//   - Caller must be authenticated as a contractor
//   - Caller must be the contractor on the specified deal
//   - Only one PENDING invite is allowed per deal (unique partial index in DB)
//   - Token is generated server-side by the DB (gen_random_uuid()) — never client-supplied
//   - Token is single-use and expires in 7 days
//
// Body: { deal_id, invited_email? }
// Returns: { invite_url, invite: { id, token, deal_id, expires_at, status } }

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

  // ── Use admin client — bypasses RLS for the deal ownership check + insert ──
  // We need to verify the contractor owns this deal, then insert an invite.
  // The invite insert RLS requires invited_by = auth.uid(), but since we're
  // using the admin client we enforce the ownership check ourselves here.
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

  // ── Check for existing pending invite ─────────────────────────────────────
  // The DB has a partial unique index (status = 'pending') but we surface a
  // human-readable conflict here before hitting the constraint.
  const { data: existingInvite } = await admin
    .from('deal_invites')
    .select('id, token, expires_at, status')
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
  const baseName = "funder-invite";

const slug = baseName
  .toLowerCase()
  .trim()
  .replace(/\s+/g, "-")
  .replace(/[^a-z0-9-]/g, "");

const { data: invite, error: insertError } = await admin
  .from("deal_invites")
  .insert({
    deal_id: dealId,
    invited_by: user.id,
    invited_email: invitedEmail,
    slug,
    status: "pending",
    // token and expires_at use DB defaults
  })
  .select("id, token, slug, deal_id, invited_email, status, expires_at, created_at")
  .single();

  if (insertError || !invite) {
    return internalError(
      'Failed to create the invite link. Please try again.',
      insertError?.message,
    )
  }

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

  const inviteUrl = buildInviteUrl(request, invite.token, invite.slug)

  // ── Send invite email (non-blocking — invite exists regardless of email outcome) ──
  let emailSent = false
  if (invitedEmail) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const from = process.env.EMAIL_FROM ?? 'Vektrum <invites@vektrum.io>'
      const expiryDate = new Date(invite.expires_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
      const { error: emailError } = await resend.emails.send({
        from,
        to: invitedEmail,
        subject: `You've been invited to fund "${deal.title}" on Vektrum`,
        html: `
          <p>Hi,</p>
          <p>You've been invited to join <strong>${deal.title}</strong> as a funder on Vektrum.</p>
          <p>Click the link below to accept your invitation and get started:</p>
          <p><a href="${inviteUrl}" style="color:#1A3A96;font-weight:bold">${inviteUrl}</a></p>
          <p style="color:#9AA3B5;font-size:13px">This link expires on ${expiryDate}. It is single-use — once accepted, it cannot be reused.</p>
          <p style="color:#9AA3B5;font-size:13px">If you were not expecting this invitation, you can safely ignore this email.</p>
          <p>— The Vektrum Team</p>
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
// Fetch the current invite status for a deal (contractor only).

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

  // Verify contractor owns this deal (or is admin)
  if (profile.role !== 'admin') {
    const { data: deal } = await admin
      .from('deals')
      .select('contractor_id')
      .eq('id', dealId)
      .single()

    if (!deal || deal.contractor_id !== user.id) {
      return errorResponse(
        403,
        'You are not the contractor on this deal.',
      )
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

  // Attach the invite URL for active invites
  const invitesWithUrls = (invites ?? []).map((inv) => ({
    ...inv,
    invite_url:
      inv.status === 'pending' ? buildInviteUrl(request, inv.token) : null,
  }))

  return NextResponse.json({ invites: invitesWithUrls })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInviteUrl(
  request: NextRequest,
  token: string,
  slug?: string | null
) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const pathPart = slug || token;
  return `${origin}/invite/${pathPart}?token=${token}`;
}