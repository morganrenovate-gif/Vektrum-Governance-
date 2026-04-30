import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Server layout guard for /dashboard/deals/new.
 * Funders, admins, and contractors may access this page.
 * Contractors must have Stripe connected before creating deals.
 * Funders and admins do not require Stripe onboarding to create a governed deal.
 */
export default async function NewDealLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/dashboard/deals/new')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role, stripe_account_id')
    .eq('id', user.id)
    .single()

  const ALLOWED_ROLES = ['contractor', 'funder', 'admin']
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    redirect('/dashboard')
  }

  // Gate: contractors must connect Stripe before creating deals.
  // Funders and admins are not required to have Stripe connected.
  if (profile.role === 'contractor' && !profile.stripe_account_id) {
    redirect('/dashboard/contractor/onboarding')
  }

  return <>{children}</>
}
