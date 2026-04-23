'use client'

import { useState, FormEvent, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [success])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 bg-vektrum-bg">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-white">
            Set new password
          </h1>
          <p className="mt-1.5 text-sm text-white/55">
            Choose a new password for your account.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-6 shadow-sm">
          {success ? (
            <div className="flex flex-col items-center text-center py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 mb-4">
                <CheckCircle2 size={20} className="text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-white">
                Password updated
              </p>
              <p className="mt-1.5 text-sm text-white/55">
                Redirecting to dashboard&hellip;
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Input
                type="password"
                label="New password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />

              <Input
                type="password"
                label="Confirm password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2.5 text-sm text-red-400"
                >
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full"
              >
                {loading ? 'Updating…' : 'Update Password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
