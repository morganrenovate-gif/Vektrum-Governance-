'use client'

/**
 * Generate-from-signed-contract CTA — funder/admin only.
 *
 * Calls POST /api/deals/{dealId}/release-rules/generate-from-contract.
 * On success, the API stores a DRAFT row and returns its id; this
 * component then router.refresh()es the deal page so the parent
 * `<ContractFullyExecutedCard>` swaps to the "Draft generated" state.
 *
 * Never sets approved status — that requires a separate human action
 * (out of scope for this pass).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, AlertCircle } from 'lucide-react'

interface GenerateReleaseRulesButtonProps {
  dealId: string
  disabled?: boolean
}

export function GenerateReleaseRulesButton({
  dealId,
  disabled,
}: GenerateReleaseRulesButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleClick() {
    if (loading || disabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/deals/${dealId}/release-rules/generate-from-contract`,
        { method: 'POST' },
      )
      const data = await res.json() as { ok?: boolean; error?: string; existing_draft_id?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Could not generate draft release rules. Please try again.')
        return
      }
      router.refresh()
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || disabled}
        className="inline-flex items-center gap-1.5 self-start rounded-lg border border-vektrum-blue/30 bg-vektrum-blue/[0.10] px-4 py-2.5 text-[13px] font-semibold text-blue-200 hover:bg-vektrum-blue/[0.18] hover:border-vektrum-blue/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        aria-busy={loading}
      >
        {loading
          ? <Loader2  size={13} className="animate-spin" aria-hidden="true" />
          : <FileText size={13} aria-hidden="true" />
        }
        {loading ? 'Generating draft…' : 'Generate draft SOV & release rules'}
      </button>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 max-w-md"
        >
          <AlertCircle size={12} className="text-red-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>
        </div>
      )}
    </div>
  )
}
