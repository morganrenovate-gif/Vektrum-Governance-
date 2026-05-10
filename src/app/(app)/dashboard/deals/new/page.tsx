/**
 * /dashboard/deals/new — Server component.
 *
 * Fetches the authenticated user's role server-side and passes it as a prop
 * to <NewDealForm role={role}>. This eliminates the role-flash bug that existed
 * when the page defaulted isContractor to false and fetched the profile
 * asynchronously, causing the funder/admin UI to appear briefly for all users.
 *
 * The layout guard already verifies the user is authenticated and has an
 * allowed role — this DB fetch is fast (same request, RLS session).
 * If the profile cannot be fetched, we redirect to /dashboard.
 */

import { redirect }          from 'next/navigation'
import { createClient }      from '@/lib/supabase/server'
import { NewDealForm }       from './new-deal-form'
import type { DealFormRole } from './new-deal-form'

export default async function NewDealPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/dashboard/deals/new')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? undefined) as DealFormRole | undefined

  const ALLOWED: DealFormRole[] = ['contractor', 'funder', 'admin']
  if (!role || !ALLOWED.includes(role)) {
    // Layout should have caught this already; redirect defensively.
    redirect('/dashboard')
  }

  return <NewDealForm role={role} />
}
