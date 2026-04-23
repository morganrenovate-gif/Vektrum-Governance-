'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: 'https://vektrum.io/auth/reset-password' },
    )

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 bg-vektrum-bg">
      <div className="w-full max-w-sm">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Back to login
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-white">
            Reset your password
          </h1>
          <p className="mt-1.5 text-sm text-white/55">
            Enter your email address and we&rsquo;ll send you a reset link.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-6 shadow-sm">
          {success ? (
            <div className="flex flex-col items-center text-center py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 mb-4">
                <CheckCircle2 size={20} className="text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-white">
                Check your email
              </p>
              <p className="mt-1.5 text-sm text-white/55">
                We&rsquo;ve sent a reset link to{' '}
                <span className="font-medium text-white">{email}</span>.
              </p>
              <Link
                href="/auth/login"
                className="mt-4 text-sm font-medium text-vektrum-blue hover:underline"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Input
                type="email"
                label="Email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
