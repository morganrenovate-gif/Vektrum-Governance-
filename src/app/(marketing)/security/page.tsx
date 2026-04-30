import type { Metadata } from 'next'
import { Shield, BookOpen, Server, Users, Key, Webhook, Lock } from 'lucide-react'

// ISR: re-render at most every hour. Public marketing — no per-user data.
export const revalidate = 3600


export const metadata: Metadata = {
  title: 'Security | Vektrum',
  description:
    'Vektrum security architecture: what we store, what we never store, API key security, webhook signing, access control, and audit log design.',
  alternates: { canonical: 'https://vektrum.io/security' },
  openGraph: {
    title: 'Security — Vektrum',
    description: 'API key security, webhook signing, access control, and audit log design.',
    url: 'https://vektrum.io/security',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'Security — Vektrum',
    description: 'API key security, webhook signing, access control, audit log design.',
  },
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[1.4rem] font-bold tracking-[-0.02em] text-white border-b border-white/[0.06] pb-3 mb-6">
      {children}
    </h2>
  )
}

function Pill({ children, color = 'blue' }: { children: React.ReactNode; color?: 'blue' | 'emerald' | 'red' | 'amber' }) {
  const colors = {
    blue:    'bg-vektrum-blue/10 text-vektrum-blue border-vektrum-blue/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red:     'bg-red-500/10 text-red-400 border-red-500/20',
    amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest ${colors[color]}`}>
      {children}
    </span>
  )
}

export default function SecurityPage() {
  return (
    <div className="bg-vektrum-bg">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 py-16 sm:py-20">

        {/* Page header */}
        <div className="mb-12">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-[-0.025em] mb-3">
            Security at Vektrum
          </h1>
          <p className="text-[15px] leading-relaxed text-white/55">
            Vektrum is authorization infrastructure. This page describes what data we store,
            how credentials are secured, and how the audit and access control layers
            are designed for tamper-evidence and auditability.
          </p>
          <p className="mt-4 text-[13px] text-amber-400/80">
            Vektrum has not obtained SOC 2, ISO 27001, PCI, or any other formal certification.
            The controls described here are designed for those goals but have not been independently audited.
            Institutional clients should request our security documentation for due diligence.
          </p>
        </div>

        <div className="space-y-14">

          {/* ── What Vektrum stores ───────────────────────────────────────── */}
          <section>
            <SectionHeading>What Vektrum stores</SectionHeading>
            <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6 space-y-5">
              {[
                {
                  icon: BookOpen,
                  title: 'Deal metadata',
                  desc: 'Deal title, parties (contractor and funder IDs), total amount, milestone definitions, status, and conditions. This is the core governance record.',
                },
                {
                  icon: BookOpen,
                  title: 'Hash-chained audit log',
                  desc: 'Every action taken on every deal — release authorizations, approvals, status changes, admin overrides, and partner confirmations. Each entry includes a hash of the previous entry, making retroactive tampering detectable. Append-only: no UPDATE or DELETE path exists at the application layer. A database trigger enforces this at the DB layer.',
                },
                {
                  icon: Server,
                  title: 'Release conditions',
                  desc: 'The pass/fail state of all 10 conditions at the exact moment a release was authorized. Permanently logged, cannot be altered.',
                },
                {
                  icon: Webhook,
                  title: 'Partner webhook delivery outcomes',
                  desc: 'For each outbound webhook: delivery timestamp, HTTP response code, retry count, and whether the partner confirmed or failed the release.',
                },
                {
                  icon: Key,
                  title: 'API key prefixes (SHA-256 hash only)',
                  desc: 'The full plaintext API key is never stored after issuance. Only the SHA-256 hash is stored for lookup. The key prefix (first 12 characters) is stored for display purposes only.',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-blue/10">
                    <item.icon size={16} className="text-vektrum-blue" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-white mb-1">{item.title}</p>
                    <p className="text-[13px] leading-relaxed text-white/55">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── What Vektrum never stores ─────────────────────────────────── */}
          <section>
            <SectionHeading>What Vektrum never stores</SectionHeading>
            <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.03] p-6 space-y-4">
              {[
                {
                  title: 'Fund balances or cash positions',
                  desc: 'Vektrum is authorization infrastructure, not a ledger for real money. Funded balance in Vektrum tracks authorization capacity — actual funds are held by Stripe or your institutional payment partner.',
                },
                {
                  title: 'Contractor bank account numbers or routing numbers',
                  desc: 'Stripe Connect holds contractor banking details for Stripe-rail deals. For external-rail deals, your payment partner holds this information. Vektrum stores no banking credentials.',
                },
                {
                  title: 'Full API keys after issuance',
                  desc: 'Partner API keys are shown once at issuance (vkp_<64-hex-chars>). After you close the issuance dialog, the plaintext key cannot be recovered from Vektrum. Only the SHA-256 hash is retained.',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-400/70 mt-2" aria-hidden="true" />
                  <div>
                    <p className="text-[14px] font-semibold text-white mb-0.5">{item.title}</p>
                    <p className="text-[13px] leading-relaxed text-white/55">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Webhook signing secret handling ────────────────────────────── */}
          <section>
            <SectionHeading>Webhook signing secret handling</SectionHeading>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6 space-y-4">
              <p className="text-[13.5px] leading-relaxed text-white/70">
                Outbound partner webhook signing requires a retrievable signing secret — the
                signature for each delivery is computed at request time, so the secret
                cannot be one-way hashed. This is different from API keys, which are
                hashed at rest and shown once at issuance.
              </p>
              <ul className="space-y-2.5 text-[13px] leading-relaxed text-white/65 list-disc list-outside ml-5">
                <li>
                  <span className="font-semibold text-white">Server-side only.</span>{' '}
                  Webhook signing secrets are never sent to client code. They are read by the
                  signer process running on the server and are not exposed in any
                  browser-visible response.
                </li>
                <li>
                  <span className="font-semibold text-white">Restricted access.</span>{' '}
                  The secret is stored in the partners table with row-level security. Only
                  the partner&apos;s administrative session and Vektrum&apos;s server-side
                  signer process can read it; no public or contractor session can.
                </li>
                <li>
                  <span className="font-semibold text-white">Issuance.</span>{' '}
                  Partners receive their secret once at creation. They can request rotation
                  on demand via the admin dashboard.
                </li>
                <li>
                  <span className="font-semibold text-white">HMAC-SHA256 signing.</span>{' '}
                  Every outbound webhook is signed with HMAC-SHA256 over the request body and
                  delivery timestamp. Verified deliveries reject signatures older than 5 minutes.
                </li>
              </ul>
              <div className="mt-4 rounded-lg border border-white/[0.08] bg-surface-3 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/65 mb-1">Roadmap</p>
                <p className="text-[12.5px] leading-relaxed text-white/65">
                  Encrypted-at-rest secret storage backed by a KMS (e.g. AWS KMS, GCP KMS)
                  is on the security roadmap. Today the secret is protected by row-level
                  security and database-level access controls; future releases will add
                  envelope encryption with a managed key service. We do not currently claim
                  KMS-backed storage.
                </p>
              </div>
            </div>
          </section>

          {/* ── API key security ──────────────────────────────────────────── */}
          <section>
            <SectionHeading>API key security</SectionHeading>
            <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  {
                    label: 'Key format',
                    value: 'vkp_ prefix + 64 hex chars = 68 chars total',
                  },
                  {
                    label: 'Storage',
                    value: 'SHA-256 hash stored — plaintext shown once and discarded',
                  },
                  {
                    label: 'Recovery',
                    value: 'Not possible — rotation issues a new key and invalidates the old one immediately',
                  },
                  {
                    label: 'Rotation authority',
                    value: 'Admin + active MFA session required to issue or rotate',
                  },
                ].map((row) => (
                  <div key={row.label} className="space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/45">{row.label}</p>
                    <p className="text-[13px] text-white/75 leading-snug">{row.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-5 border-t border-white/[0.06]">
                <p className="text-[13px] leading-relaxed text-white/55">
                  Because only the SHA-256 hash is stored, a compromised Vektrum database does not
                  expose partner API keys. An attacker with DB read access cannot derive the original key.
                </p>
              </div>
            </div>
          </section>

          {/* ── Webhook security ──────────────────────────────────────────── */}
          <section>
            <SectionHeading>Webhook security</SectionHeading>
            <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6 space-y-4">
              <div className="rounded-xl border border-vektrum-blue/15 bg-vektrum-blue/[0.04] px-4 py-3">
                <p className="text-[12.5px] font-mono text-white/70 leading-relaxed">
                  X-Vektrum-Signature: t=&lt;unix_ts&gt;,sha256=HMAC-SHA256(&lt;ts&gt;.&lt;body&gt;, secret)
                </p>
              </div>
              <div className="space-y-3 text-[13px] leading-relaxed text-white/55">
                <p>
                  All outbound webhooks are signed with HMAC-SHA256 using a partner-specific signing
                  secret. The signature covers both the timestamp and the raw request body, so any
                  modification of the payload invalidates the signature.
                </p>
                <p>
                  <strong className="text-white">Replay protection:</strong> Partners should enforce
                  a 5-minute (300-second) tolerance window on the{' '}
                  <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-[12px]">t</code>{' '}
                  timestamp. A webhook delivered more than 5 minutes after its timestamp should be
                  rejected as a potential replay attack.
                </p>
                <p>
                  Signing secrets are distinct per partner and rotatable on demand from the admin
                  dashboard. Rotation takes effect immediately — the previous secret is invalidated.
                </p>
              </div>
            </div>
          </section>

          {/* ── Access control ────────────────────────────────────────────── */}
          <section>
            <SectionHeading>Access control</SectionHeading>
            <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    role: 'Admin',
                    desc: 'Platform operations, partner management, audit export, manual overrides. All write actions require active MFA (AAL2). Admin cannot trigger milestone releases.',
                    color: 'amber' as const,
                  },
                  {
                    role: 'Funder',
                    desc: 'Fund deals, approve milestones, trigger releases. MFA required for release actions. Can only see deals they are the funder on.',
                    color: 'blue' as const,
                  },
                  {
                    role: 'Contractor',
                    desc: 'Create deals, submit draw packages, upload documentation. Cannot approve or release. Can only see their own deals.',
                    color: 'emerald' as const,
                  },
                ].map((r) => (
                  <div key={r.role} className="space-y-2">
                    <Pill color={r.color}>{r.role}</Pill>
                    <p className="text-[12.5px] leading-relaxed text-white/55">{r.desc}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-white/[0.06] space-y-2 text-[13px] leading-relaxed text-white/55">
                <p>
                  <strong className="text-white">Row-level security:</strong> Enforced at the database
                  layer via Supabase RLS policies. Users can only query rows for deals they are a
                  participant on. Admin actions bypass RLS only via the service-role client, which is
                  never exposed to the user session.
                </p>
                <p>
                  <strong className="text-white">MFA:</strong> Admin and funder roles require TOTP
                  second-factor authentication (AAL2) for all write actions that affect fund movement
                  or governance state.
                </p>
              </div>
            </div>
          </section>

          {/* ── Audit log ─────────────────────────────────────────────────── */}
          <section>
            <SectionHeading>Audit log</SectionHeading>
            <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6 space-y-4">
              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  {
                    icon: Lock,
                    title: 'Append-only by design',
                    desc: 'A database trigger fires on any UPDATE or DELETE on the audit_log table and raises an exception (SQLSTATE 23001). There is no application-level path to modify or remove a logged entry.',
                  },
                  {
                    icon: Shield,
                    title: 'Hash-chained entries',
                    desc: 'Each audit entry includes a hash of the previous entry. Retroactive insertion or modification of historical entries would invalidate the chain from the tampered point forward.',
                  },
                  {
                    icon: Users,
                    title: 'Actor attribution',
                    desc: 'Every entry records actor_id, actor_role, and system_source. Admin write actions are dual-logged to a separate admin_audit_log with a written justification.',
                  },
                  {
                    icon: BookOpen,
                    title: 'Exportable per deal',
                    desc: 'The full audit log for any deal can be exported via the admin API (GET /api/admin/deals/:id/audit-export) in JSON or CSV format. Export events are themselves logged.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-blue/10">
                      <item.icon size={14} className="text-vektrum-blue" />
                    </div>
                    <div>
                      <p className="text-[13.5px] font-semibold text-white mb-1">{item.title}</p>
                      <p className="text-[12.5px] leading-relaxed text-white/55">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Server-side enforcement ───────────────────────────────────── */}
          <section>
            <SectionHeading>Server-side enforcement</SectionHeading>
            <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6">
              <p className="text-[13px] leading-relaxed text-white/55 mb-4">
                The 10-condition release gate is evaluated atomically on the server. Client state
                is display-only — no client-side flag can bypass or influence the gate result.
                The gate runs in a single server-side call before any fund reservation or Stripe
                transfer is initiated.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  'All 10 conditions evaluated simultaneously — not sequentially',
                  'No API endpoint bypasses the gate — every release path runs it',
                  'Admin cannot release funds — gate rejects admin callers',
                  'Atomic balance reservation prevents concurrent over-authorization',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-vektrum-blue/60 mt-1.5" />
                    <span className="text-[12.5px] text-white/60 leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>

        <p className="mt-14 text-[14px] leading-relaxed text-white/55">
          For security inquiries, vendor due diligence packages, or penetration test scope
          discussions, contact{' '}
          <a href="mailto:operations@vektrum.io" className="text-vektrum-blue hover:underline">
            operations@vektrum.io
          </a>
          .
        </p>

      </div>
    </div>
  )
}
