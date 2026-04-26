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
        <h2 className="font-display text-lg font-bold text-white">Security</h2>
        <p className="mt-1 text-sm text-white/55">
          Manage your password and account access controls.
        </p>
      </div>

      {/* Password change */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-blue/10">
            <Shield size={14} className="text-blue-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-white">Change Password</p>
            <p className="text-[11px] text-white/70">Minimum 8 characters required.</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4" noValidate>
          {/* Identity is confirmed via active session */}
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
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-2.5 text-sm text-emerald-400" role="status">
              <CheckCircle2 size={14} aria-hidden="true" />
              Password updated successfully. Keep it somewhere safe.
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-start gap-2 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2.5 text-sm text-red-400" role="alert">
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

    </div>
  )
}
