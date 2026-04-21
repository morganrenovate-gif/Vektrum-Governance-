'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { DisputeFlagModal } from '@/components/ai/DisputeFlagModal'
import { DisputeBrief } from '@/components/ai/DisputeBrief'
import type { Brief } from '@/components/ai/DisputeBrief'

// ── Types ─────────────────────────────────────────────────────────────────────

type MilestoneProps = {
  id: string
  title: string
  amount: number
  status: string
}

type Props = {
  milestone: MilestoneProps
  brief: Brief | null
  role: 'funder' | 'contractor' | 'admin'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MilestoneDisputeSection({ milestone, brief, role }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  const canFlag =
    (role === 'funder' || role === 'admin') &&
    !['released', 'disputed', 'pending'].includes(milestone.status)

  return (
    <div className="mt-8 space-y-4">

      {/* Show brief if dispute is active or there is a resolved one */}
      {(milestone.status === 'disputed' || brief?.status === 'RESOLVED') && (
        <DisputeBrief
          brief={brief}
          role={role}
          milestoneId={milestone.id}
          milestoneName={milestone.title}
        />
      )}

      {/* Flag button — funders only, on eligible milestones */}
      {canFlag && milestone.status !== 'disputed' && (
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-[13px] font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
        >
          <AlertTriangle size={14} />
          Flag as disputed
        </button>
      )}

      {/* Dispute flag modal */}
      {modalOpen && (
        <DisputeFlagModal
          milestoneId={milestone.id}
          milestoneName={milestone.title}
          milestoneAmount={milestone.amount}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false)
            router.refresh()
          }}
        />
      )}

    </div>
  )
}
