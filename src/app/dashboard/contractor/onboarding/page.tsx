import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'
import { StripeOnboardingWizard } from '@/components/onboarding/stripe-onboarding-wizard'

export const metadata = {
  title: 'Contractor Setup — Vektrum',
}

export default async function ContractorOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/dashboard/contractor/onboarding')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawProfile } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!rawProfile) redirect('/auth/login')

  const profile = rawProfile as Profile

  // Only contractors should access this page
  if (profile.role !== 'contractor') redirect('/dashboard')

  // If Stripe is already connected, redirect to dashboard
  if (profile.stripe_account_id) redirect('/dashboard')

  return (
    <StripeOnboardingWizard
      role="contractor"
      stripeConnected={!!profile.stripe_account_id}
      fullName={profile.full_name}
    />
  )
}
