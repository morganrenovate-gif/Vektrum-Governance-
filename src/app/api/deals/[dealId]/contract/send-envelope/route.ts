import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { createEnvelope, DocuSignError, type DocuSignSigner } from '@/lib/engine/docusign'
import { internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/deals/[dealId]/contract/send-envelope ─────────────────────────
//
// Creates a DocuSign envelope for a contract that was uploaded without one
// (e.g. via ContractUploadSection → POST /api/deals/[dealId]/contracts, which
// stores the PDF but does not call DocuSign). This route downloads the stored
// PDF and sends it to DocuSign, then saves the returned envelope_id.
//
// Prerequisites:
//   - Active non-voided contract exists for the deal with no envelope_id yet
//   - Both contractor and funder are assigned to the deal
//
// Auth: contractor or admin (funder signs but does not initiate)
//
// Does NOT create a fake or internal signature — all signing happens in DocuSign.

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

  if (profile.role !== 'contractor' && profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only the contractor or an admin can send the contract for signing.' },
      { status: 403 },
    )
  }

  const supabase = await createClient()

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Fetch Deal ──────────────────────────────────────────────────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, contractor_id, funder_id, title')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${dealId} was not found.`)
  }

  if (profile.role === 'contractor' && deal.contractor_id !== user.id) {
    return NextResponse.json(
      { error: 'You are not the contractor on this deal.' },
      { status: 403 },
    )
  }

  if (!deal.funder_id) {
    return NextResponse.json(
      {
        error:
          'This deal does not have a funder assigned. ' +
          'Invite a funder before sending the contract for signatures.',
      },
      { status: 409 },
    )
  }

  // ── Fetch active contract — admin client to access storage_path ─────────────
  const admin = createSupabaseAdminClient()

  const { data: contractRaw, error: contractError } = await admin
    .from('contracts')
    .select('id, status, docusign_envelope_id, storage_path, document_name')
    .eq('deal_id', dealId)
    .neq('status', 'voided')
    .maybeSingle()

  if (contractError) {
    return internalError('Failed to fetch contract record.', contractError.message)
  }

  if (!contractRaw) {
    return NextResponse.json(
      { error: 'No active contract found for this deal. Upload a contract PDF first.' },
      { status: 404 },
    )
  }

  const contract = contractRaw as {
    id: string
    status: string
    docusign_envelope_id: string | null
    storage_path: string | null
    document_name: string | null
  }

  if (contract.docusign_envelope_id) {
    return NextResponse.json(
      { error: 'This contract already has a DocuSign envelope. Check the current signing status.' },
      { status: 409 },
    )
  }

  if (contract.status === 'signed') {
    return NextResponse.json(
      { error: 'This contract is already fully signed.' },
      { status: 409 },
    )
  }

  if (!contract.storage_path) {
    return internalError('Contract storage path is missing — cannot create DocuSign envelope. Contact support.')
  }

  // ── Download stored PDF ─────────────────────────────────────────────────────
  const { data: pdfBlob, error: downloadError } = await admin.storage
    .from('contracts')
    .download(contract.storage_path)

  if (downloadError || !pdfBlob) {
    return internalError(
      'Failed to download the contract PDF from storage. Please try again.',
      downloadError?.message,
    )
  }

  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

  // ── Fetch signer details ────────────────────────────────────────────────────
  const [contractorAuthUser, funderAuthUser] = await Promise.all([
    admin.auth.admin.getUserById(deal.contractor_id),
    admin.auth.admin.getUserById(deal.funder_id),
  ])

  if (contractorAuthUser.error || !contractorAuthUser.data.user?.email) {
    return internalError('Could not retrieve contractor email for DocuSign envelope.')
  }
  if (funderAuthUser.error || !funderAuthUser.data.user?.email) {
    return internalError('Could not retrieve funder email for DocuSign envelope.')
  }

  const { data: contractorProfile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', deal.contractor_id)
    .single()

  const { data: funderProfile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', deal.funder_id)
    .single()

  const funderSigner: DocuSignSigner = {
    name:         funderProfile?.full_name ?? funderProfile?.company_name ?? 'Funder',
    email:        funderAuthUser.data.user.email,
    clientUserId: deal.funder_id,
    routingOrder: 1,
  }

  const contractorSigner: DocuSignSigner = {
    name:         contractorProfile?.full_name ?? contractorProfile?.company_name ?? 'Contractor',
    email:        contractorAuthUser.data.user.email,
    clientUserId: deal.contractor_id,
    routingOrder: 2,
  }

  // ── Create DocuSign Envelope ────────────────────────────────────────────────
  let envelopeId: string
  try {
    const envelope = await createEnvelope({
      dealId,
      subject:    `Contract for signature — ${deal.title}`,
      pdfBuffer,
      fileName:   contract.document_name ?? 'contract.pdf',
      funder:     funderSigner,
      contractor: contractorSigner,
    })
    envelopeId = envelope.envelopeId
  } catch (err) {
    const message = err instanceof DocuSignError ? err.message : String(err)
    await logAudit({
      entity_type: 'contract',
      entity_id:   contract.id,
      action:      'docusign_envelope_create_failed',
      actor_id:    user.id,
      actor_role:  profile.role,
      old_values:  null,
      new_values:  null,
      metadata: {
        deal_id: dealId,
        error:   message,
      },
    })
    return internalError(
      'Failed to create the DocuSign envelope. Please try again. ' +
        'If this problem persists, contact support.',
      message,
    )
  }

  // ── Save envelope_id to contract ────────────────────────────────────────────
  const { error: updateError } = await admin
    .from('contracts')
    .update({ docusign_envelope_id: envelopeId })
    .eq('id', contract.id)

  if (updateError) {
    // Best-effort void the orphaned DocuSign envelope
    try {
      const { voidEnvelope } = await import('@/lib/engine/docusign')
      await voidEnvelope(
        envelopeId,
        'Contract record update failed after envelope creation — voiding orphaned envelope',
      )
    } catch { /* ignore void failure */ }
    return internalError(
      'Envelope was created but the envelope ID could not be saved. Please try again.',
      updateError.message,
    )
  }

  // ── Audit ───────────────────────────────────────────────────────────────────
  await logAudit({
    entity_type:   'contract',
    entity_id:     contract.id,
    action:        'docusign_envelope_sent',
    actor_id:      user.id,
    actor_role:    profile.role,
    system_source: 'api/deals/contract/send-envelope',
    old_values:    null,
    new_values: {
      docusign_envelope_id: envelopeId,
    },
    metadata: {
      deal_id:     dealId,
      contract_id: contract.id,
      envelope_id: envelopeId,
    },
  })

  return NextResponse.json({
    contract_id: contract.id,
    envelope_id: envelopeId,
    message:
      'DocuSign envelope created. The funder will be prompted to sign first, ' +
      'followed by the contractor.',
  })
}
