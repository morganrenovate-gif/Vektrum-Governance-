export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FileBox, ArrowRight, Download } from 'lucide-react'
import type { Profile } from '@/lib/types'
import { PageHeader, EmptyState } from '@/components/layout'

export default async function ContractorDocumentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/dashboard/contractor/documents')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawProfile } = await (supabase as any)
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  const profile = rawProfile as Pick<Profile, 'id' | 'role'> | null
  if (!profile || profile.role !== 'contractor') redirect('/dashboard')

  // Fetch all documents across the contractor's deals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deals } = await (supabase as any)
    .from('deals')
    .select('id, title')
    .eq('contractor_id', user.id)

  const dealIds = (deals ?? []).map((d: { id: string }) => d.id)
  const dealMap = new Map((deals ?? []).map((d: { id: string; title: string }) => [d.id, d.title]))

  let documents: {
    id: string
    milestone_id: string
    uploader_id: string
    file_name: string
    file_url: string
    file_size: number
    mime_type: string
    created_at: string
    milestone?: { deal_id: string; title: string }
  }[] = []

  if (dealIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: docs } = await (supabase as any)
      .from('milestone_documents')
      .select('id, milestone_id, uploader_id, file_name, file_url, file_size, mime_type, created_at, milestone:milestones!milestone_documents_milestone_id_fkey(deal_id, title)')
      .in('milestone_id', await getMilestoneIds(supabase, dealIds))
      .order('created_at', { ascending: false })

    documents = docs ?? []
  }

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="dash-page">
      <PageHeader
        eyebrow="Documents"
        title="Deal Documents"
        description="Files uploaded to your deal milestones"
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={FileBox}
          title="No documents yet"
          description="Your deal documents will appear here once you create a deal and attach files."
          action={{ label: 'Go to Deals', href: '/dashboard/deals/new' }}
          variant="dashed"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-surface-2 shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">Document Name</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">Deal</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">Type</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">Uploaded</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {documents.map((doc) => {
                const dealTitle = doc.milestone?.deal_id
                  ? dealMap.get(doc.milestone.deal_id) ?? 'Unknown Deal'
                  : 'Unknown Deal'
                return (
                  <tr key={doc.id} className="hover:bg-white/[0.025] transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{doc.file_name}</td>
                    <td className="px-4 py-3 text-white/80">{dealTitle as string}</td>
                    <td className="px-4 py-3 text-white/75 font-mono text-[11px]">{doc.mime_type}</td>
                    <td className="px-4 py-3 text-white/80">
                      {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(doc.created_at))}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-vektrum-blue hover:text-vektrum-blue-hover transition-colors text-xs font-semibold"
                      >
                        <Download size={12} />
                        Download
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  )
}

// Helper: get all milestone IDs for the contractor's deals
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMilestoneIds(supabase: any, dealIds: string[]): Promise<string[]> {
  if (dealIds.length === 0) return []
  const { data } = await supabase
    .from('milestones')
    .select('id')
    .in('deal_id', dealIds)
  return (data ?? []).map((m: { id: string }) => m.id)
}
