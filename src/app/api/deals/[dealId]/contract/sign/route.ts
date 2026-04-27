import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess, requireMFA } from '@/lib/auth/middleware'
import { getSigningUrl, DocuSignError, type DocuSignSigner } from '@/lib/engine/docusign'
import { logAudit } from '@/lib/engine/audit'
import { internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'


// ─── POST /api/deals/[dealId]/contract/sign ───────────────────────────────────
//
// Returns a one-time DocuSign RecipientView URL for the authenticated user.
//
// The URL opens the DocuSign signing session in the user's browser.
// After signing, DocuSign redirects to returnUrl with ?event=signing_complete.
//
// Rules:
//   - The contract must be in a state where the caller can sign.
//     Funder: must be in 'pending_signatures' (nobody has signed yet)
//             OR 'contractor_signed' (contractor signed, funder hasn't).
//     Contractor: must be in 'pending_signatures' OR 'funder_signed'.
//   - The caller must be the funder or contractor on the deal.
//   - A signing URL is only valid for ~5 minutes. Fetch it right before redirecting.
//
// Body: { returnUrl: string } — where DocuSign redirects after signing.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  if (profile.role === 'admin') {
    return NextResponse.json(
      { error: 'Admins do not sign contracts as a party. Use the funder or contractor account.' },
      { status: 403 },
    )
  }

  const supabase = await createClient()

  // ── MFA Guard — funders must be at AAL2 to sign contracts ───────────────────
  // (requireMFA automatically exempts contractors — they receive payments but
  //  do not authorize fund movements, so AAL2 is not required for their signature.)
  try {
    await requireMFA(supabase, profile)
  } catch (err) {
    return err as NextResponse
  }

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let returnUrl: string
  try {
    const body = await request.json() as { returnUrl?: string }
    if (!body.returnUrl) throw new Error('missing returnUrl')
    returnUrl = body.returnUrl
  } catch {
    return NextResponse.json(
      { error: '"returnUrl" is required in the request body.' },
      { status: 400 },
    )
  }

  // ── Fetch Deal + Contract ───────────────────────────────────────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, contractor_id, funder_id, title')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${dealId} was not found.`)
  }

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, status, docusign_envelope_id, funder_signed_at, contractor_signed_at')
    .eq('deal_id', dealId)
    .maybeSingle()

  if (contractError) {
    return internalError('Failed to fetch contract record.', contractError.message)
  }

  if (!contract) {
    return NextResponse.json(
      { error: 'No contract has been uploaded for this deal yet. The contractor must upload a PDF first.' },
      { status: 404 },
    )
  }

  if (contract.status === 'signed') {
    return NextResponse.json(
      { error: 'This contract has already been fully signed by both parties.' },
      { status: 409 },
    )
  }

  if (contract.status === 'voided') {
    return NextResponse.json(
      { error: 'This contract has been voided. A new contract must be uploaded.' },
      { status: 409 },
    )
  }

  if (!contract.docusign_envelope_id) {
    return NextResponse.json(
      {
        error: 'This contract does not have a DocuSign envelope. ' +
          'The DocuSign integration may not be configured. Contact support.',
      },
      { status: 503 },
    )
  }

  // ── Check if this user can sign ─────────────────────────────────────────────
  const isFunder     = deal.funder_id     === user.id
  const isContractor = deal.contractor_id === user.id

  if (!isFunder && !isContractor) {
    return NextResponse.json(
      { error: 'You are not a signing party on this contract.' },
      { status: 403 },
    )
  }

  if (isFunder && contract.funder_signed_at) {
    return NextResponse.json(
      { error: 'You have already signed this contract.' },
      { status: 409 },
    )
  }

  if (isContractor && contract.contractor_signed_at) {
    return NextResponse.json(
      { error: 'You have already signed this contract.' },
      { status: 409 },
    )
  }

  // Contractor signs second (routing order 2) — they cannot sign before the funder
  if (isContractor && !contract.funder_signed_at) {
    return NextResponse.json(
      {
        error: 'The funder must sign first. ' +
          'The contract will become available for your signature after the funder has signed.',
      },
      { status: 409 },
    )
  }

  // ── Build signer for RecipientView ─────────────────────────────────────────
  const admin = (await import('@/lib/supabase/server')).createSupabaseAdminClient()

  const authUser = await admin.auth.admin.getUserById(user.id)
  if (authUser.error || !authUser.data.user?.email) {
    return internalError('Could not retrieve your email address for the signing session.')
  }

  const signer: DocuSignSigner = {
    name:         profile.full_name ?? profile.company_name ?? 'Signer',
    email:        authUser.data.user.email,
    clientUserId: user.id,
    routingOrder: isFunder ? 1 : 2,
  }

  // ── Get DocuSign RecipientView URL ──────────────────────────────────────────
  let signingUrl: string
  try {
    signingUrl = await getSigningUrl({
      envelopeId: contract.docusign_envelope_id,
      signer,
      returnUrl,
    })
  } catch (err) {
    const message = err instanceof DocuSignError ? err.message : String(err)
    return internalError(
      'Failed to generate the signing URL. Please try again. ' +
        'If this problem persists, contact support.',
      message,
    )
  }

  // ── Audit ───────────────────────────────────────────────────────────────────
  // Records that a signing session was initiated for this contract by this
  // party. Metadata captures who is signing (role) and which envelope, but
  // NOT the signer's email address — DocuSign holds the authoritative
  // recipient record, and the auth.users row remains the source of truth
  // for re-resolving identity if needed.
  await logAudit({
    entity_type:   'contract',
    entity_id:     contract.id,
    action:        'contract_signing_initiated',
    actor_id:      user.id,
    actor_role:    profile.role,
    system_source: 'api/deals/contract/sign',
    metadata: {
      deal_id:      dealId,
      contract_id:  contract.id,
      envelope_id:  contract.docusign_envelope_id,
      signer_role:  isFunder ? 'funder' : 'contractor',
      signer_count: 1,
    },
  })

  return NextResponse.json({
    signing_url:  signingUrl,
    role:         isFunder ? 'funder' : 'contractor',
    envelope_id:  contract.docusign_envelope_id,
    // The URL expires in ~5 minutes — the client should redirect immediately
    expires_hint: 'Redirect the user to signing_url within 5 minutes.',
  })
}
