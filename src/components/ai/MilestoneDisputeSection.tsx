'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { DisputeFlagModal } from '@/components/ai/DisputeFlagModal'
import { DisputeBrief } from '@/components/ai/DisputeBrief'
import type { Brief } from '@/components/ai/DisputeBrief'
import type { MilestoneStatus, UserRole } from '@/lib/types'

type MilestoneProps = {
  id: string
  title: string
  amount: number
  status: MilestoneStatus
}

type Props = {
  milestone: MilestoneProps
  brief: Brief | null
  role: UserRole
}

// Statuses where flagging a dispute is not permitted
const NON_FLAGGABLE_STATUSES: MilestoneStatus[] = ['released', 'disputed', 'not_started']

export function MilestoneDisputeSection({ milestone, brief, role }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [flagged, setFlagged] = useState(false)

  const canFlag =
    (role === 'funder' || role === 'admin') &&
    !NON_FLAGGABLE_STATUSES.includes(milestone.status)

  const handleSuccess = () => {
    setModalOpen(false)
    setFlagged(true)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {/* Show brief if dispute is active or there is a resolved one */}
      {(milestone.status === 'disputed' || brief?.status === 'RESOLVED') && (
        <DisputeBrief
          brief={brief}
          role={role}
          milestoneId={milestone.id}
          milestoneName={milestone.title}
        />
      )}

      {/* Success confirmation after flagging */}
      {flagged && (
        <div className="notice-success">
          <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>
            Dispute flagged. The milestone has been marked as disputed and both parties have been notified.
          </span>
        </div>
      )}

      {/* Flag button — funders and admins only, on eligible milestones */}
      {canFlag && milestone.status !== 'disputed' && !flagged && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
        >
          <AlertTriangle size={14} aria-hidden="true" />
          Flag as Disputed
        </button>
      )}

      {/* Dispute flag modal */}
      {modalOpen && (
        <DisputeFlagModal
          milestoneId={milestone.id}
          milestoneName={milestone.title}
          milestoneAmount={milestone.amount}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
