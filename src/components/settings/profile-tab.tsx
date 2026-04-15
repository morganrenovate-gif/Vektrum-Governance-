'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, Mail } from 'lucide-react'

interface ProfileTabProps {
  profile: Profile
  userEmail: string
}

export function ProfileTab({ profile, userEmail }: ProfileTabProps) {
  const [fullName, setFullName]       = useState(profile.full_name ?? '')
  const [companyName, setCompanyName] = useState(profile.company_name ?? '')
  const [saving, setSaving]           = useState(false)
  const [saveStatus, setSaveStatus]   = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError]     = useState<string | null>(null)

  // Email change state
  const [newEmail, setNewEmail]           = useState('')
  const [emailChanging, setEmailChanging] = useState(false)
  const [emailStatus, setEmailStatus]     = useState<'idle' | 'sent' | 'error'>('idle')
  const [emailError, setEmailError]       = useState<string | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveStatus('idle')
    setSaveError(null)

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        full_name:    fullName.trim() || null,
        company_name: companyName.trim() || null,
      })
      .eq('id', profile.id)

    setSaving(false)
    if (error) {
      setSaveStatus('error')
      setSaveError(error.message)
    } else {
      setSaveStatus('success')
      // Auto-clear success after 4s
      setTimeout(() => setSaveStatus('idle'), 4000)
    }
  }

  async function handleEmailChange(e: FormEvent) {
    e.preventDefault()
    if (!newEmail.trim() || newEmail.trim() === userEmail) return
    setEmailChanging(true)
    setEmailStatus('idle')
    setEmailError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: `${window.location.origin}/auth/callback` }
    )

    setEmailChanging(false)
    if (error) {
      setEmailStatus('error')
      setEmailError(error.message)
    } else {
      setEmailStatus('sent')
      setNewEmail('')
      setShowEmailForm(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-vektrum-text">Profile</h2>
        <p className="mt-1 text-sm text-vektrum-muted">
          Your name and company as they appear to counterparties in your deals.
        </p>
      </div>

      {/* Profile form */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6 shadow-sm">
        <form onSubmit={handleProfileSave} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setSaveStatus('idle') }}
            placeholder="Jane Smith"
            autoComplete="name"
          />
          <Input
            label="Company Name"
            type="text"
            value={companyName}
            onChange={(e) => { setCompanyName(e.target.value); setSaveStatus('idle') }}
            placeholder="Acme Construction Ltd."
            autoComplete="organization"
            helperText="Optional"
          />

          {/* Save feedback */}
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 rounded-md bg-vektrum-green-bg border border-vektrum-green-border px-3 py-2.5 text-sm text-vektrum-green" role="status">
              <CheckCircle2 size={14} aria-hidden="true" />
              Profile saved successfully.
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-start gap-2 rounded-md bg-vektrum-red-bg border border-vektrum-red-border px-3 py-2.5 text-sm text-vektrum-red" role="alert">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {saveError ?? 'Failed to save. Please try again.'}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>

      {/* Email section */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-blue-subtle mt-0.5">
              <Mail size={15} className="text-vektrum-blue" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-vektrum-text">Email Address</p>
              <p className="text-[13px] text-vektrum-muted mt-0.5">{userEmail}</p>
              <p className="text-[11px] text-vektrum-faint mt-1">
                Used for sign-in and all platform notifications.
              </p>
            </div>
          </div>
          {!showEmailForm && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowEmailForm(true)}
            >
              Change email
            </Button>
          )}
        </div>

        {showEmailForm && (
          <form onSubmit={handleEmailChange} className="mt-5 space-y-3 border-t border-vektrum-border-subtle pt-5">
            <Input
              label="New Email Address"
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setEmailStatus('idle') }}
              placeholder="new@company.com"
              autoComplete="email"
              required
            />
            {emailStatus === 'error' && (
              <div className="flex items-start gap-2 rounded-md bg-vektrum-red-bg border border-vektrum-red-border px-3 py-2.5 text-sm text-vektrum-red" role="alert">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                {emailError ?? 'Failed to send verification. Please try again.'}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => { setShowEmailForm(false); setEmailStatus('idle') }}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={emailChanging}>
                {emailChanging ? 'Sending…' : 'Send Verification'}
              </Button>
            </div>
          </form>
        )}

        {emailStatus === 'sent' && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-vektrum-green-bg border border-vektrum-green-border px-3 py-2.5 text-sm text-vektrum-green" role="status">
            <CheckCircle2 size={14} aria-hidden="true" />
            Verification email sent. Click the link in your inbox to confirm the change.
          </div>
        )}

        {/* Profile photo — coming soon */}
        <div className="mt-5 border-t border-vektrum-border-subtle pt-5">
          <div className="flex items-center justify-between opacity-60 cursor-not-allowed select-none">
            <div className="pointer-events-none">
              <p className="text-[13px] font-semibold text-vektrum-muted">Profile Photo</p>
              <p className="text-[11px] text-vektrum-faint mt-0.5">Upload a photo to personalize your account.</p>
            </div>
            <span className="flex-shrink-0 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[10px] font-semibold text-vektrum-amber">
              Coming soon
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
