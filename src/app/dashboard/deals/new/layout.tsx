import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Server layout guard for /dashboard/deals/new.
 * Only contractors can create deals. Funders and admins are redirected.
 */
export default async function NewDealLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/dashboard/deals/new')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'contractor') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
