import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'
import { FunderRailChoiceWizard } from '@/components/onboarding/funder-rail-choice-wizard'

export const metadata = {
  title: 'Funder Setup — Vektrum',
}

export default async function FunderOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/dashboard/funder/onboarding')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawProfile } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!rawProfile) redirect('/auth/login')

  const profile = rawProfile as Profile

  // Only funders should access this page
  if (profile.role !== 'funder') redirect('/dashboard')

  // If the funder has already chosen a rail (Stripe, external, or
  // explicitly "not_configured"), do not loop them back into onboarding —
  // they can revisit it from Settings.
  if (profile.disbursement_rail) redirect('/dashboard')

  return (
    <FunderRailChoiceWizard
      fullName={profile.full_name}
      stripeConnected={!!profile.stripe_account_id}
      currentRail={profile.disbursement_rail}
    />
  )
}
