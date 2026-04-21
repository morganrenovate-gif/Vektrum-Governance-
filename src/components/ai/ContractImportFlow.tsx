'use client'

import { useState } from 'react'
import { FileUp } from 'lucide-react'
import { ContractUploadModal } from '@/components/ai/ContractUploadModal'
import { MilestoneReviewScreen } from '@/components/ai/MilestoneReviewScreen'
import type { ContractAnalysisResult, DealMetadata } from '@/lib/actions/analyze-contract'

// ── Types ─────────────────────────────────────────────────────────────────────

type FlowState =
  | { stage: 'manual' }
  | { stage: 'upload_modal' }
  | { stage: 'review'; result: ContractAnalysisResult }

type Props = {
  metadata: DealMetadata
  children: React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContractImportFlow({ metadata, children }: Props) {
  const [flow, setFlow] = useState<FlowState>({ stage: 'manual' })

  if (flow.stage === 'review') {
    return (
      <MilestoneReviewScreen
        initialMilestones={flow.result.milestones}
        totalValue={flow.result.total_value}
        missingClauses={flow.result.missing_clauses}
        retainageSummary={flow.result.retainage_summary}
        metadata={metadata}
        onStartOver={() => setFlow({ stage: 'manual' })}
      />
    )
  }

  return (
    <>
      {/* Import from contract button */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-vektrum-border" />
        <button
          onClick={() => setFlow({ stage: 'upload_modal' })}
          className="inline-flex items-center gap-2 rounded-xl border border-vektrum-blue/30 bg-vektrum-blue/5 px-4 py-2 text-[13px] font-semibold text-vektrum-blue hover:bg-vektrum-blue/10 hover:border-vektrum-blue/50 transition-all"
        >
          <FileUp size={14} />
          Import from contract
        </button>
        <div className="flex-1 h-px bg-vektrum-border" />
      </div>

      {/* Existing manual milestone form */}
      {children}

      {/* Upload modal */}
      {flow.stage === 'upload_modal' && (
        <ContractUploadModal
          metadata={metadata}
          onSuccess={(result) => setFlow({ stage: 'review', result })}
          onClose={() => setFlow({ stage: 'manual' })}
        />
      )}
    </>
  )
}
