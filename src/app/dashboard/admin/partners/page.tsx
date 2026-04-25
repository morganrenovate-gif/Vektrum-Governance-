'use client'

import React from 'react'

export const dynamic = 'force-dynamic'

// ─── Admin — Partner Management ───────────────────────────────────────────────
//
// Create and manage institutional execution-rail partners (construction loan
// servicers, title companies, escrow agents). Partners receive signed webhooks
// when the release gate passes and confirm execution via the partner API.
//
// Features:
//   - List all partners with deal count and active status
//   - Create a new partner (generates API key + webhook signing secret, shown once)
//   - Toggle active/inactive without deleting (preserves audit trail)
//   - Rotate API key or webhook signing secret
//   - Assign a partner to a deal (via the deal's partner_id field)

import { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Webhook,
  Key,
  ArrowLeft,
  AlertTriangle,
  Shield,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Partner {
  id:              string
  name:            string
  webhook_url:     string | null
  api_key_prefix:  string
  is_active:       boolean
  notes:           string | null
  created_at:      string
  updated_at:      string
  deal_count:      number
  has_webhook:     boolean
  webhook_url_masked: string | null
}

interface NewCredentials {
  api_key?:               string
  webhook_signing_secret?: string
  warning:                string
}

// ─── Copy-to-clipboard helper ─────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label ?? 'value'}`}
      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── Credential reveal box ────────────────────────────────────────────────────

function CredentialBox({ label, value }: { label: string; value: string }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        <div className="flex items-center gap-2">
          <CopyButton value={value} label={label} />
          <button
            onClick={() => setRevealed((v: boolean) => !v)}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
          >
            {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
            {revealed ? 'Hide' : 'Reveal'}
          </button>
        </div>
      </div>
      <div className="font-mono text-xs bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-zinc-300 break-all">
        {revealed ? value : '•'.repeat(Math.min(value.length, 48))}
      </div>
    </div>
  )
}

// ─── Create partner form ──────────────────────────────────────────────────────

function CreatePartnerForm({
  onCreated,
}: {
  onCreated: (partner: Partner, credentials: NewCredentials) => void
}) {
  const [name,       setName]       = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [notes,      setNotes]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/partners', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:        name.trim(),
          webhook_url: webhookUrl.trim() || undefined,
          notes:       notes.trim()      || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.errors?.join(' ') ?? data.error ?? 'Failed to create partner.')
        return
      }

      onCreated(data.partner, data.credentials)
      setName('')
      setWebhookUrl('')
      setNotes('')
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1">
          Partner name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          placeholder="National Western Financial, Land Gorilla, etc."
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1">
          Webhook URL
          <span className="text-zinc-500 font-normal ml-1">(HTTPS required — optional if partner polls)</span>
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWebhookUrl(e.target.value)}
          placeholder="https://partner-system.com/webhooks/vektrum"
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
          placeholder="Company type, primary contact, integration notes..."
          rows={2}
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded px-3 py-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
      >
        {loading ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <Plus size={14} />
        )}
        {loading ? 'Creating...' : 'Create partner'}
      </button>
    </form>
  )
}

// ─── New credentials modal ────────────────────────────────────────────────────

function NewCredentialsModal({
  partnerName,
  credentials,
  onClose,
}: {
  partnerName:  string
  credentials:  NewCredentials
  onClose:      () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <AlertTriangle size={18} />
            <span className="font-semibold text-sm">Store these credentials now</span>
          </div>
          <p className="text-xs text-zinc-400">
            These values are shown <strong className="text-white">once only</strong> and cannot be recovered.
            Save them in your secrets manager before closing this dialog.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-300">
            Partner: <strong className="text-white">{partnerName}</strong>
          </p>

          {credentials.api_key && (
            <CredentialBox label="API Key (for partner → Vektrum calls)" value={credentials.api_key} />
          )}

          {credentials.webhook_signing_secret && (
            <CredentialBox
              label="Webhook Signing Secret (partner uses to verify Vektrum webhooks)"
              value={credentials.webhook_signing_secret}
            />
          )}

          <div className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded p-3 space-y-1">
            <p className="font-medium text-zinc-300">Integration guide:</p>
            <p>1. Give the partner their <strong>API Key</strong> to authenticate callbacks to <code className="text-blue-400">/api/partner/releases/[id]/confirm</code> and <code className="text-blue-400">/api/partner/releases/[id]/fail</code>.</p>
            <p>2. Give the partner the <strong>Webhook Signing Secret</strong> so they can verify that incoming webhooks are from Vektrum. Verification: <code className="text-blue-400">HMAC-SHA256(&apos;{'<timestamp>.<body>'}&apos;, secret)</code>.</p>
          </div>
        </div>

        <div className="p-5 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium py-2 rounded transition-colors"
          >
            I have saved these credentials
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Partner card ─────────────────────────────────────────────────────────────

function PartnerCard({
  partner,
  onUpdated,
}: {
  partner:   Partner
  onUpdated: (updated: Partner, credentials?: NewCredentials) => void
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const patch = async (body: Record<string, unknown>) => {
    setError(null)
    const res = await fetch(`/api/admin/partners/${partner.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.errors?.join(' ') ?? data.error ?? 'Update failed.')
      return null
    }
    return data
  }

  const toggleActive = async () => {
    setLoading('toggle')
    const data = await patch({ is_active: !partner.is_active })
    if (data) onUpdated(data.partner)
    setLoading(null)
  }

  const rotateKey = async () => {
    if (!confirm(`Rotate API key for ${partner.name}? The current key will be immediately invalidated.`)) return
    setLoading('rotate_key')
    const data = await patch({ action: 'rotate_key' })
    if (data) onUpdated(data.partner, data.credentials)
    setLoading(null)
  }

  const rotateSecret = async () => {
    if (!confirm(`Rotate webhook signing secret for ${partner.name}? Update your verification logic before rotating.`)) return
    setLoading('rotate_secret')
    const data = await patch({ action: 'rotate_secret' })
    if (data) onUpdated(data.partner, data.credentials)
    setLoading(null)
  }

  const statusColor = partner.is_active
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-700/40'
    : 'bg-zinc-700/40 text-zinc-500 border-zinc-600/40'

  return (
    <div className={`bg-zinc-900 border rounded-xl p-5 space-y-4 transition-opacity ${!partner.is_active ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 size={16} className="text-blue-400" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">{partner.name}</div>
            <div className="text-xs text-zinc-500 font-mono mt-0.5">{partner.api_key_prefix}••••</div>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>
          {partner.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-zinc-800/60 rounded-lg p-2">
          <div className="text-sm font-semibold text-white">{partner.deal_count}</div>
          <div className="text-xs text-zinc-500">Deals</div>
        </div>
        <div className="bg-zinc-800/60 rounded-lg p-2">
          <div className="flex items-center justify-center gap-1">
            {partner.has_webhook
              ? <Webhook size={13} className="text-emerald-400" />
              : <Webhook size={13} className="text-zinc-600" />
            }
          </div>
          <div className="text-xs text-zinc-500">Webhook</div>
        </div>
        <div className="bg-zinc-800/60 rounded-lg p-2">
          <div className="flex items-center justify-center gap-1">
            <Shield size={13} className="text-blue-400" />
          </div>
          <div className="text-xs text-zinc-500">Signed</div>
        </div>
      </div>

      {/* Webhook URL */}
      {partner.webhook_url_masked && (
        <div className="text-xs text-zinc-500">
          <span className="text-zinc-400 font-medium">Webhook: </span>
          {partner.webhook_url_masked}
        </div>
      )}

      {/* Notes */}
      {partner.notes && (
        <p className="text-xs text-zinc-500 leading-relaxed">{partner.notes}</p>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-800">
        <button
          onClick={toggleActive}
          disabled={!!loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
        >
          {loading === 'toggle'
            ? <RefreshCw size={11} className="animate-spin" />
            : partner.is_active
              ? <ToggleRight size={11} className="text-emerald-400" />
              : <ToggleLeft size={11} className="text-zinc-500" />
          }
          {partner.is_active ? 'Deactivate' : 'Activate'}
        </button>

        <button
          onClick={rotateKey}
          disabled={!!loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
        >
          {loading === 'rotate_key'
            ? <RefreshCw size={11} className="animate-spin" />
            : <Key size={11} />
          }
          Rotate key
        </button>

        <button
          onClick={rotateSecret}
          disabled={!!loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
        >
          {loading === 'rotate_secret'
            ? <RefreshCw size={11} className="animate-spin" />
            : <Webhook size={11} />
          }
          Rotate secret
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PartnersAdminPage() {
  const [partners,     setPartners]     = useState<Partner[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showCreate,   setShowCreate]   = useState(false)
  const [newCreds,     setNewCreds]     = useState<{ name: string; creds: NewCredentials } | null>(null)

  const fetchPartners = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/partners')
      const data = await res.json()
      if (res.ok) setPartners(data.partners ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPartners() }, [fetchPartners])

  const handleCreated = (partner: Partner, credentials: NewCredentials) => {
    setPartners((prev: Partner[]) => [{ ...partner, deal_count: 0, has_webhook: !!partner.webhook_url, webhook_url_masked: null }, ...prev])
    setShowCreate(false)
    setNewCreds({ name: partner.name, creds: credentials })
  }

  const handleUpdated = (updated: Partner, credentials?: NewCredentials) => {
    setPartners((prev: Partner[]) => prev.map((p: Partner) => p.id === updated.id ? { ...p, ...updated } : p))
    if (credentials) {
      setNewCreds({ name: updated.name, creds: credentials })
    }
  }

  const activeCount   = partners.filter((p: Partner) => p.is_active).length
  const inactiveCount = partners.filter((p: Partner) => !p.is_active).length
  const totalDeals    = partners.reduce((s: number, p: Partner) => s + p.deal_count, 0)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Nav */}
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Admin dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Execution-Rail Partners</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Institutional partners (escrow companies, construction loan servicers, title companies)
              that receive Vektrum authorization signals and execute payments on their own licensed rails.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v: boolean) => !v)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <Plus size={14} />
            Add partner
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active partners',   value: activeCount,   color: 'text-emerald-400' },
            { label: 'Inactive partners', value: inactiveCount, color: 'text-zinc-500'    },
            { label: 'Deals assigned',    value: totalDeals,    color: 'text-blue-400'    },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Plus size={14} className="text-blue-400" />
              New execution-rail partner
            </h2>
            <CreatePartnerForm onCreated={handleCreated} />
          </div>
        )}

        {/* How it works */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 text-xs text-zinc-400 space-y-2">
          <p className="font-medium text-zinc-300 text-sm">How partner webhooks work</p>
          <p>
            When a funder authorizes a release on an external-rail deal that has a partner assigned, Vektrum
            fires a signed <code className="text-blue-400">release.authorized</code> webhook to the partner&apos;s URL.
          </p>
          <p>
            The partner executes the wire/ACH on their own rails, then calls
            <code className="text-blue-400 mx-1">POST /api/partner/releases/[id]/confirm</code>
            with their API key to record the execution. Vektrum settles the ledger and creates the billing record.
          </p>
          <p>
            Signature verification: <code className="text-blue-400">X-Vektrum-Signature: t=&lt;ts&gt;,sha256=HMAC(ts.body, secret)</code>
          </p>
        </div>

        {/* Partner list */}
        {loading ? (
          <div className="text-center py-16 text-zinc-500 text-sm">Loading partners...</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Building2 size={32} className="text-zinc-700 mx-auto" />
            <p className="text-zinc-500 text-sm">No partners yet.</p>
            <p className="text-zinc-600 text-xs max-w-sm mx-auto">
              Add your first institutional execution-rail partner to enable machine-to-machine
              payment authorization.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map((partner: Partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onUpdated={handleUpdated}
              />
            ))}
          </div>
        )}
      </div>

      {/* New credentials modal */}
      {newCreds && (
        <NewCredentialsModal
          partnerName={newCreds.name}
          credentials={newCreds.creds}
          onClose={() => setNewCreds(null)}
        />
      )}
    </div>
  )
}
