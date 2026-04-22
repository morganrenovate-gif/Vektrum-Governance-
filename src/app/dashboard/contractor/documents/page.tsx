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
    <div className="min-h-screen bg-[#0D1B2A]">
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-8">
      <div>
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px w-5 bg-vektrum-blue" />
          <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Documents</p>
        </div>
        <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">Deal Documents</h1>
        <p className="mt-2 text-[15px] text-white/55">Files uploaded to your deal milestones</p>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-white/[0.08]">
          <FileBox size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white font-medium mb-1">No documents yet</p>
          <p className="text-white/50 text-sm mb-5">
            Your deal documents will appear here once you create a deal and attach files.
          </p>
          <Link
            href="/dashboard/deals/new"
            className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-6 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 transition-all hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5"
          >
            Go to Deals
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#111827]"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Document Name</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Deal</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Type</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Uploaded</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {documents.map((doc) => {
                const dealTitle = doc.milestone?.deal_id
                  ? dealMap.get(doc.milestone.deal_id) ?? 'Unknown Deal'
                  : 'Unknown Deal'
                return (
                  <tr key={doc.id} className="hover:bg-white/[0.025] transition-colors">
                    <td className="px-4 py-3 font-medium text-white/80">{doc.file_name}</td>
                    <td className="px-4 py-3 text-white/45">{dealTitle as string}</td>
                    <td className="px-4 py-3 text-white/40 font-mono text-[11px]">{doc.mime_type}</td>
                    <td className="px-4 py-3 text-white/45">
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
