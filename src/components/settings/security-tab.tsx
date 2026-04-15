'use client'

// Advisor 4 (Security): Password change must have explicit success confirmation
// and force-clear the form. No silent failures under any circumstance.
// Advisor 10 (Adversarial): Enforce min length client-side AND rely on Supabase
// server-side enforcement. Never trust only client validation.

import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, Shield, Smartphone } from 'lucide-react'

export function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving]                   = useState(false)
  const [status, setStatus]                   = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg]               = useState<string | null>(null)

  function validate(): string | null {
    if (newPassword.length < 8) return 'New password must be at least 8 characters.'
    if (newPassword !== confirmPassword) return 'Passwords do not match.'
    if (newPassword === currentPassword) return 'New password must differ from your current password.'
    return null
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setStatus('idle')
    setErrorMsg(null)

    const validationError = validate()
    if (validationError) {
      setStatus('error')
      setErrorMsg(validationError)
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      // Advisor 4: Force-clear the form on success. Never leave passwords in DOM.
      setStatus('success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-vektrum-text">Security</h2>
        <p className="mt-1 text-sm text-vektrum-muted">
          Manage your password and account access controls.
        </p>
      </div>

      {/* Password change */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
            <Shield size={14} className="text-vektrum-blue" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-vektrum-text">Change Password</p>
            <p className="text-[11px] text-vektrum-faint">Minimum 8 characters required.</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4" noValidate>
          {/* Note: Supabase doesn't expose a "verify current password" endpoint
              for browser clients — we rely on Supabase's session to confirm identity.
              The current password field is included for UX convention but cannot be
              verified client-side. Advisor 4 acknowledged: acceptable for now. */}
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setStatus('idle') }}
            placeholder="Your current password"
            autoComplete="current-password"
            required
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setStatus('idle') }}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            required
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setStatus('idle') }}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            required
          />

          {status === 'success' && (
            <div className="flex items-center gap-2 rounded-md bg-vektrum-green-bg border border-vektrum-green-border px-3 py-2.5 text-sm text-vektrum-green" role="status">
              <CheckCircle2 size={14} aria-hidden="true" />
              Password updated successfully. Keep it somewhere safe.
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-start gap-2 rounded-md bg-vektrum-red-bg border border-vektrum-red-border px-3 py-2.5 text-sm text-vektrum-red" role="alert">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {errorMsg ?? 'Failed to update password. Please try again.'}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              {saving ? 'Updating…' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>

      {/* 2FA — coming soon */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6 shadow-sm opacity-60 cursor-not-allowed select-none">
        <div className="pointer-events-none flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-surface-alt mt-0.5">
              <Smartphone size={14} className="text-vektrum-faint" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-vektrum-muted">Two-Factor Authentication</p>
              <p className="text-[12px] text-vektrum-faint mt-0.5 max-w-sm">
                Add a second layer of protection with an authenticator app. Required for admin accounts in a future release.
              </p>
            </div>
          </div>
          <span className="flex-shrink-0 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[10px] font-semibold text-vektrum-amber">
            Coming soon
          </span>
        </div>
      </div>

      {/* Active sessions — coming soon */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6 shadow-sm opacity-60 cursor-not-allowed select-none">
        <div className="pointer-events-none flex items-start justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-vektrum-muted">Active Sessions</p>
            <p className="text-[12px] text-vektrum-faint mt-0.5 max-w-sm">
              View and revoke all active login sessions across devices.
            </p>
          </div>
          <span className="flex-shrink-0 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[10px] font-semibold text-vektrum-amber">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  )
}
