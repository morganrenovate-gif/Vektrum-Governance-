'use client'

import { useState } from 'react'
import { FileUp } from 'lucide-react'
import { ContractUploadModal } from '@/components/ai/ContractUploadModal'
import { MilestoneReviewScreen } from '@/components/ai/MilestoneReviewScreen'
import type { ContractAnalysisResult, DealMetadata } from '@/lib/actions/analyze-contract'

type FlowState =
  | { stage: 'manual' }
  | { stage: 'upload_modal' }
  | { stage: 'review'; result: ContractAnalysisResult }

type Props = {
  metadata: DealMetadata
  children: React.ReactNode
  renderTrigger?: (openImport: () => void) => React.ReactNode
}

export function ContractImportFlow({ metadata, children, renderTrigger }: Props) {
  const [flow, setFlow] = useState<FlowState>({ stage: 'manual' })

  const openImport = () => setFlow({ stage: 'upload_modal' })

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
      {!renderTrigger && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <button
            type="button"
            onClick={openImport}
            className="inline-flex items-center gap-2 rounded-xl border border-vektrum-blue/30 bg-vektrum-blue/5 px-4 py-2 text-[13px] font-semibold text-vektrum-blue hover:bg-vektrum-blue/10 hover:border-vektrum-blue/50 transition-all"
          >
            <FileUp size={14} />
            Import from contract
          </button>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>
      )}

      {children}

      {renderTrigger?.(openImport)}

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