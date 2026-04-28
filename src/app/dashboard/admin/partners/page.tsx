'use client'

// ─── Admin — Partner API Integrations Dashboard ───────────────────────────────
//
// Full lifecycle management for institutional execution-rail partners:
// construction loan servicers, title companies, escrow agents.
//
// Features:
//   - Summary strip: Active, Inactive, Live keys, Test keys, Deals, Pending, Failed
//   - Per-partner card: last_used_at, key_environment badge, deal assignment,
//     pending/failed release counts, revoke vs. deactivate distinction
//   - Create partner: Live/Test key selector, credentials shown once on creation
//   - Key rotation, webhook secret rotation (credentials shown once)
//   - Distinct revoke action (audit: partner_key_revoked) vs. toggle inactive
//   - Deal assignment modal: assign / unassign external-manual deals
//   - Admin + AAL2 MFA gate enforced server-side on all mutations

import React, { useState, useEffect, useCallback } from 'react'
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
  XCircle,
  Link2,
  Link2Off,
  Clock,
  FlaskConical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Partner {
  id:                     string
  name:                   string
  webhook_url:            string | null
  api_key_prefix:         string
  is_active:              boolean
  notes:                  string | null
  key_environment:        'test' | 'live'
  last_used_at:           string | null
  created_at:             string
  updated_at:             string
  deal_count:             number
  pending_confirmations:  number
  failed_releases:        number
  has_webhook:            boolean
  webhook_url_masked:     string | null
}

interface DealSummary {
  id:             string
  title:          string
  status:         string
  execution_rail: string
  funded_amount:  number | null
  released_amount?: number | null
  created_at:     string
}

interface NewCredentials {
  api_key?:               string
  webhook_signing_secret?: string
  key_environment?:       'test' | 'live'
  warning:                string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never used'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'Just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  < 30)  return `${days}d ago`
  return fmtDate(iso)
}

// ─── EnvBadge ─────────────────────────────────────────────────────────────────

function EnvBadge({ env }: { env: 'test' | 'live' }) {
  if (env === 'test') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-600/40 font-medium">
        <FlaskConical size={10} />
        test
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-600/40 font-medium">
      <Shield size={10} />
      live
    </span>
  )
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

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

// ─── CredentialBox ────────────────────────────────────────────────────────────

function CredentialBox({ label, value }: { label: string; value: string }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        <div className="flex items-center gap-2">
          <CopyButton value={value} label={label} />
          <button
            onClick={() => setRevealed((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
          >
            {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
            {revealed ? 'Hide' : 'Reveal'}
          </button>
        </div>
      </div>
      <div className="font-mono text-xs bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-zinc-300 break-all select-all">
        {revealed ? value : '•'.repeat(Math.min(value.length, 52))}
      </div>
    </div>
  )
}

// ─── ConfirmInline ────────────────────────────────────────────────────────────

function ConfirmInline({
  message,
  confirmLabel             = 'Confirm',
  confirmClass             = 'bg-red-700 hover:bg-red-600 text-white',
  onConfirm,
  onCancel,
  requireJustification     = false,
  justification            = '',
  onJustificationChange,
  justificationPlaceholder = 'Enter reason for this action (min 20 chars)…',
  minJustificationLen      = 20,
}: {
  message:                  string
  confirmLabel?:            string
  confirmClass?:            string
  onConfirm:                () => void
  onCancel:                 () => void
  /** When true, a justification textarea is shown and confirm is disabled until met. */
  requireJustification?:    boolean
  justification?:           string
  onJustificationChange?:   (v: string) => void
  justificationPlaceholder?: string
  minJustificationLen?:     number
}) {
  const justificationMet = !requireJustification || justification.trim().length >= minJustificationLen
  return (
    <div className="flex flex-col gap-2 text-xs text-zinc-300 bg-zinc-800/80 border border-zinc-700 rounded px-3 py-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
        <span className="flex-1">{message}</span>
        <button
          onClick={onConfirm}
          disabled={!justificationMet}
          title={!justificationMet ? `Enter at least ${minJustificationLen} characters to confirm` : undefined}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${confirmClass} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {confirmLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
      {requireJustification && (
        <textarea
          value={justification}
          onChange={(e) => onJustificationChange?.(e.target.value)}
          placeholder={justificationPlaceholder}
          rows={2}
          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600 resize-none"
          aria-label="Justification for this action"
        />
      )}
    </div>
  )
}

// ─── NewCredentialsModal ──────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl">

        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <AlertTriangle size={18} />
            <span className="font-semibold text-sm">Store these credentials now — shown once only</span>
          </div>
          <p className="text-xs text-zinc-400">
            These values <strong className="text-white">cannot be recovered</strong> after closing this dialog.
            Save them in your secrets manager immediately.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-zinc-300">Partner: <strong className="text-white">{partnerName}</strong></p>
            {credentials.key_environment && <EnvBadge env={credentials.key_environment} />}
          </div>

          {credentials.api_key && (
            <CredentialBox label="API Key (partner → Vektrum authentication)" value={credentials.api_key} />
          )}

          {credentials.webhook_signing_secret && (
            <CredentialBox
              label="Webhook Signing Secret (partner verifies inbound webhooks from Vektrum)"
              value={credentials.webhook_signing_secret}
            />
          )}

          <div className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded p-3 space-y-1.5">
            <p className="font-medium text-zinc-300">Integration checklist</p>
            <p>1. Hand the partner their <strong className="text-zinc-200">API Key</strong> to authenticate calls to
              {' '}<code className="text-blue-400">/api/partner/releases/[id]/confirm</code> and
              {' '}<code className="text-blue-400">/api/partner/releases/[id]/fail</code>.</p>
            <p>2. Hand the partner the <strong className="text-zinc-200">Webhook Signing Secret</strong> so they can verify
              inbound webhooks from Vektrum. Verification:
              {' '}<code className="text-blue-400">HMAC-SHA256(&apos;{'<ts>.<body>'}&apos;, secret)</code>.</p>
            {credentials.key_environment === 'test' && (
              <p className="text-amber-400 font-medium">⚠ Test key — does not process real funds. Use for sandbox integration only.</p>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium py-2.5 rounded transition-colors"
          >
            I have saved these credentials — close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DealAssignmentModal ──────────────────────────────────────────────────────

function DealAssignmentModal({
  partner,
  onClose,
  onChanged,
}: {
  partner:   Partner
  onClose:   () => void
  onChanged: () => void
}) {
  const [assigned,   setAssigned]   = useState<DealSummary[]>([])
  const [available,  setAvailable]  = useState<DealSummary[]>([])
  const [loading,    setLoading]    = useState(true)
  const [working,    setWorking]    = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/admin/partners/${partner.id}/deals`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load deals.'); return }
      setAssigned(data.assigned   ?? [])
      setAvailable(data.available ?? [])
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }, [partner.id])

  useEffect(() => { load() }, [load])

  const assign = async (dealId: string) => {
    setWorking(dealId)
    setError(null)
    try {
      const res  = await fetch(`/api/admin/partners/${partner.id}/deals`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deal_id: dealId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to assign deal.'); return }
      await load()
      onChanged()
    } catch {
      setError('Network error.')
    } finally {
      setWorking(null)
    }
  }

  const unassign = async (dealId: string) => {
    setWorking(dealId)
    setError(null)
    try {
      const res  = await fetch(`/api/admin/partners/${partner.id}/deals`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deal_id: dealId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to unassign deal.'); return }
      await load()
      onChanged()
    } catch {
      setError('Network error.')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-white text-sm">Deal assignment — {partner.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Only external-manual deals without a partner can be assigned.
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <XCircle size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Loading deals…</div>
          ) : (
            <>
              {/* Assigned */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Assigned ({assigned.length})
                </h4>
                {assigned.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">No deals assigned yet.</p>
                ) : (
                  <div className="space-y-2">
                    {assigned.map((deal) => (
                      <div key={deal.id} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-3 py-2 gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">{deal.title}</p>
                          <p className="text-xs text-zinc-500">{deal.status} · {deal.execution_rail}</p>
                        </div>
                        <button
                          onClick={() => unassign(deal.id)}
                          disabled={working === deal.id}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          {working === deal.id
                            ? <RefreshCw size={10} className="animate-spin" />
                            : <Link2Off size={10} />
                          }
                          Unassign
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Available to assign ({available.length})
                </h4>
                {available.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">
                    No unassigned external-manual deals available.
                    Deals must use the external-manual execution rail and have no partner assigned.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {available.map((deal) => (
                      <div key={deal.id} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-3 py-2 gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">{deal.title}</p>
                          <p className="text-xs text-zinc-500">{deal.status} · {deal.execution_rail}</p>
                        </div>
                        <button
                          onClick={() => assign(deal.id)}
                          disabled={working === deal.id}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          {working === deal.id
                            ? <RefreshCw size={10} className="animate-spin" />
                            : <Link2 size={10} />
                          }
                          Assign
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2 rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CreatePartnerForm ────────────────────────────────────────────────────────

function CreatePartnerForm({
  onCreated,
}: {
  onCreated: (partner: Partner, credentials: NewCredentials) => void
}) {
  const [name,       setName]       = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [notes,      setNotes]      = useState('')
  const [keyEnv,     setKeyEnv]     = useState<'live' | 'test'>('live')
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
          name:            name.trim(),
          key_environment: keyEnv,
          webhook_url:     webhookUrl.trim() || undefined,
          notes:           notes.trim()      || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.errors?.join(' ') ?? data.error ?? 'Failed to create partner.')
        return
      }
      onCreated(data.partner, { ...data.credentials, key_environment: keyEnv })
      setName(''); setWebhookUrl(''); setNotes(''); setKeyEnv('live')
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Key environment selector */}
      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-2">Key environment</label>
        <div className="flex gap-2">
          {(['live', 'test'] as const).map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => setKeyEnv(env)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors font-medium ${
                keyEnv === env
                  ? env === 'live'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-amber-600/20 border-amber-500 text-amber-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {env === 'live' ? <Shield size={11} /> : <FlaskConical size={11} />}
              {env === 'live' ? 'Live (production)' : 'Test (sandbox)'}
            </button>
          ))}
        </div>
        {keyEnv === 'test' && (
          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1.5">
            <AlertTriangle size={11} />
            Test key (<code className="font-mono">vkp_test_…</code>) — will not process real funds.
            Create separate live partner for production use.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1">
          Partner name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://partner-system.com/webhooks/vektrum"
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Company type, primary contact, integration notes…"
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
        {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
        {loading ? 'Creating…' : 'Create partner'}
      </button>
    </form>
  )
}

// ─── PartnerCard ──────────────────────────────────────────────────────────────

function PartnerCard({
  partner,
  onUpdated,
  onDealAssign,
}: {
  partner:      Partner
  onUpdated:    (updated: Partner, credentials?: NewCredentials) => void
  onDealAssign: (partner: Partner) => void
}) {
  const [loading,              setLoading]              = useState<string | null>(null)
  const [error,                setError]                = useState<string | null>(null)
  const [showDestructive,      setShowDestructive]      = useState(false)
  const [confirmRevoke,        setConfirmRevoke]        = useState(false)
  const [confirmRotateKey,     setConfirmRotateKey]     = useState(false)
  const [confirmRotateSec,     setConfirmRotateSec]     = useState(false)
  const [confirmToggle,        setConfirmToggle]        = useState(false)
  // Justification text for admin_audit_log (required for destructive credential operations)
  const [rotateKeyJustif,      setRotateKeyJustif]      = useState('')
  const [rotateSecJustif,      setRotateSecJustif]      = useState('')
  const [revokeJustif,         setRevokeJustif]         = useState('')

  const patch = async (body: Record<string, unknown>) => {
    setError(null)
    const res  = await fetch(`/api/admin/partners/${partner.id}`, {
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
    setConfirmToggle(false)
    setLoading(null)
  }

  const rotateKey = async () => {
    setLoading('rotate_key')
    const data = await patch({ action: 'rotate_key', justification: rotateKeyJustif.trim() })
    if (data) onUpdated(data.partner, { ...data.credentials, key_environment: partner.key_environment })
    setConfirmRotateKey(false)
    setRotateKeyJustif('')
    setLoading(null)
  }

  const rotateSecret = async () => {
    setLoading('rotate_secret')
    const data = await patch({ action: 'rotate_secret', justification: rotateSecJustif.trim() })
    if (data) onUpdated(data.partner, data.credentials)
    setConfirmRotateSec(false)
    setRotateSecJustif('')
    setLoading(null)
  }

  const revokePartner = async () => {
    setLoading('revoke')
    const data = await patch({ action: 'revoke', justification: revokeJustif.trim() })
    if (data) onUpdated(data.partner)
    setConfirmRevoke(false)
    setRevokeJustif('')
    setLoading(null)
  }

  const statusColor = partner.is_active
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-700/40'
    : 'bg-zinc-700/40 text-zinc-500 border-zinc-600/40'

  const hasPendingOrFailed = partner.pending_confirmations > 0 || partner.failed_releases > 0

  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 transition-opacity ${!partner.is_active ? 'opacity-60' : ''}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 size={16} className="text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">{partner.name}</span>
              <EnvBadge env={partner.key_environment} />
            </div>
            <div className="text-xs text-zinc-500 font-mono mt-0.5">{partner.api_key_prefix}••••</div>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${statusColor}`}>
          {partner.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-zinc-800/60 rounded-lg p-2">
          <div className="text-sm font-semibold text-white">{partner.deal_count}</div>
          <div className="text-xs text-zinc-500">Deals</div>
        </div>
        <div className={`bg-zinc-800/60 rounded-lg p-2 ${partner.pending_confirmations > 0 ? 'ring-1 ring-amber-600/40' : ''}`}>
          <div className={`text-sm font-semibold ${partner.pending_confirmations > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
            {partner.pending_confirmations}
          </div>
          <div className="text-xs text-zinc-500">Pending</div>
        </div>
        <div className={`bg-zinc-800/60 rounded-lg p-2 ${partner.failed_releases > 0 ? 'ring-1 ring-red-600/40' : ''}`}>
          <div className={`text-sm font-semibold ${partner.failed_releases > 0 ? 'text-red-400' : 'text-zinc-500'}`}>
            {partner.failed_releases}
          </div>
          <div className="text-xs text-zinc-500">Failed</div>
        </div>
        <div className="bg-zinc-800/60 rounded-lg p-2">
          {partner.has_webhook
            ? <Webhook size={13} className="text-emerald-400 mx-auto" />
            : <Webhook size={13} className="text-zinc-600 mx-auto" />
          }
          <div className="text-xs text-zinc-500 mt-0.5">Webhook</div>
        </div>
      </div>

      {/* Pending/failed alert */}
      {hasPendingOrFailed && (
        <div className="flex items-center gap-2 text-xs bg-amber-950/20 border border-amber-800/30 rounded px-3 py-2 text-amber-400">
          <AlertTriangle size={11} className="flex-shrink-0" />
          {partner.pending_confirmations > 0 && `${partner.pending_confirmations} release${partner.pending_confirmations > 1 ? 's' : ''} awaiting partner confirmation`}
          {partner.pending_confirmations > 0 && partner.failed_releases > 0 && ' · '}
          {partner.failed_releases > 0 && <span className="text-red-400">{partner.failed_releases} failed release{partner.failed_releases > 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* Last used */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Clock size={11} className="flex-shrink-0" />
        <span>Last API call: <span className={partner.last_used_at ? 'text-zinc-300' : 'text-zinc-600'}>{timeAgo(partner.last_used_at)}</span></span>
        {partner.webhook_url_masked && (
          <>
            <span className="text-zinc-700">·</span>
            <Webhook size={11} className="flex-shrink-0 text-zinc-600" />
            <span className="truncate text-zinc-600" title={partner.webhook_url ?? undefined}>{partner.webhook_url_masked}</span>
          </>
        )}
      </div>

      {/* Notes */}
      {partner.notes && (
        <p className="text-xs text-zinc-500 leading-relaxed">{partner.notes}</p>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2 flex items-center gap-1.5">
          <AlertTriangle size={11} />
          {error}
        </div>
      )}

      {/* Primary actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-800">
        <button
          onClick={() => onDealAssign(partner)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          <Link2 size={11} />
          Deals ({partner.deal_count})
        </button>

        <button
          onClick={() => { setConfirmToggle(true); setShowDestructive(false) }}
          disabled={!!loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
        >
          {loading === 'toggle'
            ? <RefreshCw size={11} className="animate-spin" />
            : partner.is_active
              ? <ToggleRight size={11} className="text-emerald-400" />
              : <ToggleLeft  size={11} className="text-zinc-500" />
          }
          {partner.is_active ? 'Deactivate' : 'Activate'}
        </button>

        <button
          onClick={() => setShowDestructive((v) => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors ml-auto"
        >
          {showDestructive ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          More
        </button>
      </div>

      {/* Toggle confirm */}
      {confirmToggle && (
        <ConfirmInline
          message={partner.is_active
            ? `Deactivate ${partner.name}? Their API key will stop working immediately.`
            : `Reactivate ${partner.name}? Their existing key prefix will be restored.`}
          confirmLabel={partner.is_active ? 'Deactivate' : 'Activate'}
          confirmClass={partner.is_active ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-emerald-700 hover:bg-emerald-600 text-white'}
          onConfirm={toggleActive}
          onCancel={() => setConfirmToggle(false)}
        />
      )}

      {/* Destructive actions panel */}
      {showDestructive && (
        <div className="space-y-2 bg-zinc-950/50 border border-zinc-800 rounded-lg p-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Credential actions</p>

          {/* Rotate key */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-300 font-medium">Rotate API key</p>
              <p className="text-xs text-zinc-600">Old key immediately invalid. New key shown once.</p>
            </div>
            <button
              onClick={() => setConfirmRotateKey(true)}
              disabled={!!loading}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-50 flex-shrink-0 ml-3"
            >
              {loading === 'rotate_key' ? <RefreshCw size={10} className="animate-spin" /> : <Key size={10} />}
              Rotate
            </button>
          </div>
          {confirmRotateKey && (
            <ConfirmInline
              message={`Rotate API key for ${partner.name}? The current key will stop working immediately.`}
              confirmLabel="Rotate key"
              onConfirm={rotateKey}
              onCancel={() => { setConfirmRotateKey(false); setRotateKeyJustif('') }}
              requireJustification
              justification={rotateKeyJustif}
              onJustificationChange={setRotateKeyJustif}
              justificationPlaceholder="Reason for rotating this key (min 20 chars)…"
            />
          )}

          {/* Rotate secret */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-300 font-medium">Rotate webhook secret</p>
              <p className="text-xs text-zinc-600">Update partner verification logic before rotating.</p>
            </div>
            <button
              onClick={() => setConfirmRotateSec(true)}
              disabled={!!loading}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-50 flex-shrink-0 ml-3"
            >
              {loading === 'rotate_secret' ? <RefreshCw size={10} className="animate-spin" /> : <Webhook size={10} />}
              Rotate
            </button>
          </div>
          {confirmRotateSec && (
            <ConfirmInline
              message={`Rotate webhook signing secret for ${partner.name}? Ensure their verification logic is updated first.`}
              confirmLabel="Rotate secret"
              onConfirm={rotateSecret}
              onCancel={() => { setConfirmRotateSec(false); setRotateSecJustif('') }}
              requireJustification
              justification={rotateSecJustif}
              onJustificationChange={setRotateSecJustif}
              justificationPlaceholder="Reason for rotating this webhook secret (min 20 chars)…"
            />
          )}

          {/* Revoke */}
          {partner.is_active && (
            <>
              <div className="border-t border-zinc-800 pt-2 mt-2 flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-400 font-medium">Revoke partner access</p>
                  <p className="text-xs text-zinc-600">Permanent deactivation with distinct audit record. Use for terminated partnerships.</p>
                </div>
                <button
                  onClick={() => setConfirmRevoke(true)}
                  disabled={!!loading}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-900/40 hover:bg-red-800/50 border border-red-800/40 text-red-400 hover:text-red-300 disabled:opacity-50 flex-shrink-0 ml-3"
                >
                  {loading === 'revoke' ? <RefreshCw size={10} className="animate-spin" /> : <XCircle size={10} />}
                  Revoke
                </button>
              </div>
              {confirmRevoke && (
                <ConfirmInline
                  message={`Revoke ${partner.name}? This logs a partner_key_revoked audit event and immediately deactivates their access.`}
                  confirmLabel="Revoke access"
                  onConfirm={revokePartner}
                  onCancel={() => { setConfirmRevoke(false); setRevokeJustif('') }}
                  requireJustification
                  justification={revokeJustif}
                  onJustificationChange={setRevokeJustif}
                  justificationPlaceholder="Reason for revoking this partner's access (min 20 chars)…"
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PartnersAdminPage() {
  const [partners,   setPartners]   = useState<Partner[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newCreds,   setNewCreds]   = useState<{ name: string; creds: NewCredentials } | null>(null)
  const [dealModal,  setDealModal]  = useState<Partner | null>(null)

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
    setPartners((prev) => [{
      ...partner,
      deal_count:            0,
      pending_confirmations: 0,
      failed_releases:       0,
      has_webhook:           !!partner.webhook_url,
      webhook_url_masked:    partner.webhook_url
        ? `${new URL(partner.webhook_url).origin}/...`
        : null,
    }, ...prev])
    setShowCreate(false)
    setNewCreds({ name: partner.name, creds: credentials })
  }

  const handleUpdated = (updated: Partner, credentials?: NewCredentials) => {
    setPartners((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated } : p))
    if (credentials) setNewCreds({ name: updated.name, creds: credentials })
  }

  // Recompute deal count after assignment modal changes
  const handleDealChanged = () => fetchPartners()

  // Summary stats
  const activeCount   = partners.filter((p) => p.is_active).length
  const inactiveCount = partners.filter((p) => !p.is_active).length
  const liveCount     = partners.filter((p) => p.key_environment === 'live').length
  const testCount     = partners.filter((p) => p.key_environment === 'test').length
  const totalDeals    = partners.reduce((s, p) => s + p.deal_count, 0)
  const totalPending  = partners.reduce((s, p) => s + p.pending_confirmations, 0)
  const totalFailed   = partners.reduce((s, p) => s + p.failed_releases, 0)

  const stats = [
    { label: 'Active',   value: activeCount,   color: 'text-emerald-400' },
    { label: 'Inactive', value: inactiveCount,  color: 'text-zinc-500'    },
    { label: 'Live keys', value: liveCount,     color: 'text-blue-400'    },
    { label: 'Test keys', value: testCount,     color: 'text-amber-400'   },
    { label: 'Deals',    value: totalDeals,     color: 'text-white'       },
    { label: 'Pending',  value: totalPending,   color: totalPending  > 0 ? 'text-amber-400' : 'text-zinc-600' },
    { label: 'Failed',   value: totalFailed,    color: totalFailed   > 0 ? 'text-red-400'   : 'text-zinc-600' },
  ]

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
              Institutional partners that receive Vektrum authorization signals
              and execute payments on their own licensed rails.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <Plus size={14} />
            Add partner
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-7 gap-3">
          {stats.map(({ label, value, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-zinc-600 mt-0.5 leading-tight">{label}</div>
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

        {/* Integration reference */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 text-xs text-zinc-400 space-y-2">
          <p className="font-medium text-zinc-300 text-sm">How partner webhooks work</p>
          <p>
            When a funder authorizes a release on an external-rail deal with a partner assigned, Vektrum fires a signed
            {' '}<code className="text-blue-400">release.authorized</code> webhook to the partner&apos;s URL.
            The partner executes the payment, then calls
            {' '}<code className="text-blue-400">POST /api/partner/releases/[id]/confirm</code> with their API key.
          </p>
          <p>
            Signature header: <code className="text-blue-400">X-Vektrum-Signature: t=&lt;ts&gt;,sha256=HMAC(ts.body, secret)</code>
            {' · '}API keys: <code className="text-blue-400">vkp_live_…</code> or <code className="text-blue-400">vkp_test_…</code>
          </p>
        </div>

        {/* Partner list */}
        {loading ? (
          <div className="text-center py-16 text-zinc-500 text-sm">Loading partners…</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Building2 size={32} className="text-zinc-700 mx-auto" />
            <p className="text-zinc-500 text-sm">No partners yet.</p>
            <p className="text-zinc-600 text-xs max-w-sm mx-auto">
              Add your first institutional execution-rail partner to enable
              machine-to-machine payment authorization.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map((partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onUpdated={handleUpdated}
                onDealAssign={setDealModal}
              />
            ))}
          </div>
        )}

      </div>

      {/* Credentials modal */}
      {newCreds && (
        <NewCredentialsModal
          partnerName={newCreds.name}
          credentials={newCreds.creds}
          onClose={() => setNewCreds(null)}
        />
      )}

      {/* Deal assignment modal */}
      {dealModal && (
        <DealAssignmentModal
          partner={dealModal}
          onClose={() => setDealModal(null)}
          onChanged={handleDealChanged}
        />
      )}
    </div>
  )
}
