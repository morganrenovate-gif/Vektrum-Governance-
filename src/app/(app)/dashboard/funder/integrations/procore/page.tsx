import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'
import { ProcoreSandboxTab } from '@/components/settings/procore-sandbox-tab'

export const metadata = { title: 'Procore Development Sandbox — Vektrum' }

export default async function ProcoreIntegrationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/dashboard/funder/integrations/procore')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  if (!data || (data as Profile).role !== 'funder') redirect('/dashboard')
  return <div className="min-h-screen bg-surface-0"><div className="dash-page"><ProcoreSandboxTab /></div></div>
}
