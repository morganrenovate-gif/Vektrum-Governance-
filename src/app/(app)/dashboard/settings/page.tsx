import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'
import { SettingsShell } from '@/components/settings/settings-shell'

export const metadata = {
  title: 'Account Settings — Vektrum',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/dashboard/settings')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawProfile } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!rawProfile) redirect('/dashboard')

  const profile = rawProfile as Profile

  return (
    <SettingsShell
      profile={profile}
      // Email lives in auth.users, not profiles — pass from server
      userEmail={user.email ?? ''}
    />
  )
}
