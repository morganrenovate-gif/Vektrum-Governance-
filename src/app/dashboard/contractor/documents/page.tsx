export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FileBox, ArrowRight, Download } from 'lucide-react'
import type { Profile } from '@/lib/types'

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
    <div className="page-container section space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-vektrum-text">Documents</h1>
        <p className="mt-1 text-sm text-vektrum-muted">
          Files uploaded to your deal milestones
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-vektrum-border rounded-2xl">
          <FileBox size={40} className="mx-auto text-vektrum-faint mb-3" />
          <p className="text-vektrum-text font-medium mb-1">No documents yet</p>
          <p className="text-vektrum-muted text-sm mb-4">
            Your deal documents will appear here once you create a deal and attach files.
          </p>
          <Link
            href="/dashboard/deals/new"
            className="inline-flex items-center gap-1.5 bg-vektrum-blue text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-vektrum-blue-hover transition-colors"
          >
            Go to Deals
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vektrum-border bg-vektrum-surface-alt">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-vektrum-muted">
                  Document Name
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-vektrum-muted">
                  Deal
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-vektrum-muted">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-vektrum-muted">
                  Uploaded
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-vektrum-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vektrum-border-subtle">
              {documents.map((doc) => {
                const dealTitle = doc.milestone?.deal_id
                  ? dealMap.get(doc.milestone.deal_id) ?? 'Unknown Deal'
                  : 'Unknown Deal'
                return (
                  <tr key={doc.id} className="hover:bg-vektrum-surface-alt transition-colors">
                    <td className="px-4 py-3 font-medium text-vektrum-text">{doc.file_name}</td>
                    <td className="px-4 py-3 text-vektrum-muted">{dealTitle as string}</td>
                    <td className="px-4 py-3 text-vektrum-muted">{doc.mime_type}</td>
                    <td className="px-4 py-3 text-vektrum-muted">
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }).format(new Date(doc.created_at))}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-vektrum-blue hover:underline text-xs font-medium"
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
