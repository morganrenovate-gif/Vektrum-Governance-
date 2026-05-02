/**
 * Server-only signed-contract text extraction.
 *
 * Pulls the signed PDF from Supabase Storage (preferring the post-DocuSign
 * `signed_storage_path` written by the envelope-completed webhook, falling
 * back to the original upload at `storage_path`) and runs it through
 * pdf-parse — same path used by /api/analyze-contract.
 *
 * Why a separate helper: the analyze-contract route accepts a multipart
 * upload and expects the file in memory; this helper accepts a contract
 * row and resolves the bytes from storage.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server'

interface ContractRow {
  id:                  string
  storage_path?:       string | null
  signed_storage_path?: string | null
}

export interface ExtractTextOk  { ok: true;  text: string; sourcePath: string }
export interface ExtractTextErr { ok: false; error: string; reason: 'no_path' | 'download_failed' | 'parse_failed' | 'empty' }

export async function extractSignedContractText(
  contract: ContractRow,
): Promise<ExtractTextOk | ExtractTextErr> {
  // Prefer the signed PDF — DocuSign returns a combined PDF with all
  // signatures applied, which is the document the funder/contractor reviewed.
  // Fall back to the original upload if signed isn't on disk yet.
  const path = contract.signed_storage_path ?? contract.storage_path ?? null
  if (!path) {
    return {
      ok:     false,
      reason: 'no_path',
      error:  'Could not locate the signed contract file. Enter release rules manually.',
    }
  }

  const admin = createSupabaseAdminClient()
  const { data: blob, error: dlErr } = await admin.storage
    .from('contracts')
    .download(path)

  if (dlErr || !blob) {
    console.error(
      '[contract-text] storage download failed',
      { contract_id: contract.id, source_path_present: !!path, error: dlErr?.message },
    )
    return {
      ok:     false,
      reason: 'download_failed',
      error:  'Could not download the signed contract file. Enter release rules manually.',
    }
  }

  const buffer = Buffer.from(await blob.arrayBuffer())

  // pdf-parse v2.x — class-based API. Match the analyze-contract route exactly.
  let parser: InstanceType<typeof import('pdf-parse').PDFParse> | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require('pdf-parse') as typeof import('pdf-parse')
    parser = new PDFParse({ data: buffer })
    const parsed = await parser.getText()
    const text = (parsed.text ?? '').trim()
    if (!text) {
      return {
        ok:     false,
        reason: 'empty',
        error:
          'No readable text found in the signed contract. It may be a scanned image without OCR. ' +
          'Enter release rules manually.',
      }
    }
    return { ok: true, text, sourcePath: path }
  } catch (err) {
    console.error('[contract-text] PDF parse error', { contract_id: contract.id, error: String(err).slice(0, 200) })
    return {
      ok:     false,
      reason: 'parse_failed',
      error:
        'Could not read the signed contract PDF. It may be password-protected or corrupted. ' +
        'Enter release rules manually.',
    }
  } finally {
    try { await parser?.destroy() } catch { /* non-fatal */ }
  }
}
