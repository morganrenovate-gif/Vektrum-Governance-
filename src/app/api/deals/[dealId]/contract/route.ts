import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import {
  createEnvelope,
  DocuSignError,
  type DocuSignSigner,
} from '@/lib/engine/docusign'
import { internalError, notFoundError, validationError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// Vercel body size limit is 4.5 MB on Hobby, 50 MB on Pro.
// Set a 20 MB application-level cap here to give a clear error before Vercel rejects.
const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB


// ─── GET /api/deals/[dealId]/contract ─────────────────────────────────────────
//
// Returns the contract record for a deal and a time-limited signed download URL.
// Both parties and admins can fetch this.

export async function GET(
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
  const supabase = await createClient()

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .select(
      'id, deal_id, status, document_name, document_size_bytes, ' +
      'docusign_envelope_id, funder_signed_at, contractor_signed_at, ' +
      'created_at, updated_at, voided_at, void_reason, storage_path',
    )
    .eq('deal_id', dealId)
    .maybeSingle()

  if (error) {
    return internalError('Failed to fetch contract record.', error.message)
  }

  if (!contract) {
    return NextResponse.json({ contract: null }, { status: 200 })
  }

  // Supabase's generated types don't include our custom columns — cast via unknown
  const row = contract as unknown as Record<string, unknown>
  const storagePath       = row['storage_path'] as string | null
  const signedStoragePath = row['signed_storage_path'] as string | null

  // Generate a short-lived signed URL for the original PDF (30 minutes)
  const admin = createSupabaseAdminClient()
  let documentUrl: string | null = null
  if (storagePath) {
    const { data: signedUrlData } = await admin.storage
      .from('contracts')
      .createSignedUrl(storagePath, 1800)
    documentUrl = signedUrlData?.signedUrl ?? null
  }

  // Generate a signed URL for the final signed document if available
  let signedDocumentUrl: string | null = null
  if (signedStoragePath) {
    const { data: signedDocUrl } = await admin.storage
      .from('contracts')
      .createSignedUrl(signedStoragePath, 1800)
    signedDocumentUrl = signedDocUrl?.signedUrl ?? null
  }

  // Strip internal storage paths before sending to client
  const { storage_path: _sp, signed_storage_path: _ssp, ...contractPublic } =
    row as Record<string, unknown>

  return NextResponse.json({
    contract: {
      ...contractPublic,
      document_url:        documentUrl,
      signed_document_url: signedDocumentUrl,
    },
  })
}


// ─── POST /api/deals/[dealId]/contract ────────────────────────────────────────
//
// Uploads a contract PDF and creates a DocuSign envelope for dual-party signing.
//
// Only the contractor who owns the deal may upload.
// The deal must be in 'draft' status.
// The deal must not already have a 'signed' or 'pending_signatures' contract
// (void the existing one first).
//
// Body: multipart/form-data
//   file  — the contract PDF (required, max 20 MB)

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
      { error: 'Only the contractor can upload a contract. Funders sign but do not upload.' },
      { status: 403 },
    )
  }

  const supabase = await createClient()

  // ── Fetch Deal ──────────────────────────────────────────────────────────────
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, status, contractor_id, funder_id, title')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${dealId} was not found.`)
  }

  if (deal.status !== 'draft') {
    return NextResponse.json(
      {
        error: `Contract can only be uploaded while the deal is in 'draft' status. ` +
          `This deal is currently '${deal.status}'.`,
      },
      { status: 409 },
    )
  }

  // Only the contractor who owns the deal may upload
  if (profile.role === 'contractor' && deal.contractor_id !== user.id) {
    return NextResponse.json(
      { error: 'You are not the contractor on this deal.' },
      { status: 403 },
    )
  }

  // ── Check for existing non-voided contract ─────────────────────────────────
  const { data: existing } = await supabase
    .from('contracts')
    .select('id, status')
    .eq('deal_id', dealId)
    .maybeSingle()

  if (existing && existing.status !== 'voided') {
    return NextResponse.json(
      {
        error: `This deal already has a contract in '${existing.status}' status. ` +
          `Void the existing contract before uploading a new version.`,
      },
      { status: 409 },
    )
  }

  // ── Parse multipart file upload ─────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return validationError(['Invalid form data. Send the file as multipart/form-data with field name "file".'])
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return validationError(['"file" field is required in the multipart body.'])
  }

  if (file.type !== 'application/pdf') {
    return validationError([`Invalid file type: '${file.type}'. Only PDF files are accepted.`])
  }

  if (file.size > MAX_FILE_BYTES) {
    return validationError([
      `File size ${(file.size / 1_048_576).toFixed(1)} MB exceeds the 20 MB limit. ` +
        'Compress the PDF or split into a smaller file.',
    ])
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath  = `${dealId}/${crypto.randomUUID()}-${safeFileName}`

  // ── Upload to Supabase Storage ──────────────────────────────────────────────
  const admin = createSupabaseAdminClient()

  const { error: uploadError } = await admin.storage
    .from('contracts')
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert:      false,
      cacheControl: '3600',
    })

  if (uploadError) {
    return internalError(
      'Failed to upload the contract PDF to storage. Please try again.',
      uploadError.message,
    )
  }

  // ── Fetch signer details (emails from auth.users) ──────────────────────────
  // Both parties must have profiles; the funder must be assigned to the deal.
  if (!deal.funder_id) {
    // Clean up the uploaded file before returning
    await admin.storage.from('contracts').remove([storagePath])
    return NextResponse.json(
      {
        error: 'This deal does not have a funder assigned. ' +
          'Invite a funder before uploading the contract.',
      },
      { status: 409 },
    )
  }

  const [contractorAuthUser, funderAuthUser] = await Promise.all([
    admin.auth.admin.getUserById(deal.contractor_id),
    admin.auth.admin.getUserById(deal.funder_id),
  ])

  if (contractorAuthUser.error || !contractorAuthUser.data.user?.email) {
    await admin.storage.from('contracts').remove([storagePath])
    return internalError('Could not retrieve contractor email for DocuSign envelope.')
  }
  if (funderAuthUser.error || !funderAuthUser.data.user?.email) {
    await admin.storage.from('contracts').remove([storagePath])
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
  let envelopeId: string | null = null

  try {
    const envelope = await createEnvelope({
      dealId,
      subject: `Contract for signature — ${deal.title}`,
      pdfBuffer:   fileBuffer,
      fileName:    safeFileName,
      funder:      funderSigner,
      contractor:  contractorSigner,
    })
    envelopeId = envelope.envelopeId
  } catch (err) {
    // DocuSign is not available (missing env vars, network failure, etc.)
    // We still save the contract record — signing can be triggered later.
    const message = err instanceof DocuSignError ? err.message : String(err)
    await logAudit({
      entity_type: 'contract',
      entity_id:   dealId,
      action:      'docusign_envelope_create_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        deal_id:      dealId,
        storage_path: storagePath,
        error:        message,
      },
    })
    // Proceed without an envelope_id — the contract row is still created
  }

  // ── Insert Contract Record ──────────────────────────────────────────────────
  // If an existing voided row exists, we insert a fresh row (the old UNIQUE
  // constraint is satisfied because the old row still exists — we don't delete
  // voided records). To handle this cleanly: delete the voided row first.
  if (existing?.status === 'voided') {
    await admin.from('contracts').delete().eq('id', existing.id)
  }

  const { data: contract, error: insertError } = await admin
    .from('contracts')
    .insert({
      deal_id:             dealId,
      uploaded_by:         user.id,
      storage_path:        storagePath,
      document_name:       file.name,
      document_size_bytes: file.size,
      docusign_envelope_id: envelopeId,
      status:              'pending_signatures',
    })
    .select()
    .single()

  if (insertError || !contract) {
    // Roll back storage upload
    await admin.storage.from('contracts').remove([storagePath])
    if (envelopeId) {
      // Best-effort void the orphaned DocuSign envelope
      try {
        const { voidEnvelope } = await import('@/lib/engine/docusign')
        await voidEnvelope(envelopeId, 'Contract record insert failed — voiding orphaned envelope')
      } catch { /* ignore */ }
    }
    return internalError(
      'Contract PDF was uploaded but the contract record could not be saved. ' +
        'The upload has been rolled back. Please try again.',
      insertError?.message,
    )
  }

  await logAudit({
    entity_type: 'contract',
    entity_id:   contract.id,
    action:      'contract_uploaded',
    actor_id:    user.id,
    old_values:  null,
    new_values: {
      deal_id:              dealId,
      document_name:        file.name,
      docusign_envelope_id: envelopeId,
      status:               'pending_signatures',
    },
    metadata: {
      deal_id:       dealId,
      storage_path:  storagePath,
      envelope_id:   envelopeId,
      file_size:     file.size,
    },
  })

  return NextResponse.json(
    {
      contract: {
        id:                   contract.id,
        deal_id:              dealId,
        status:               contract.status,
        document_name:        contract.document_name,
        docusign_envelope_id: contract.docusign_envelope_id,
        created_at:           contract.created_at,
      },
      next_step: envelopeId
        ? 'Use POST /contract/sign to get signing URLs for each party.'
        : 'DocuSign envelope was not created (configuration issue). Signing URLs unavailable.',
    },
    { status: 201 },
  )
}
