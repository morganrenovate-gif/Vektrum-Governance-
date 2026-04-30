import Link from 'next/link'
import { ArrowRight, CheckCircle2, Shield, Zap, FileText } from 'lucide-react'
import type { Metadata } from 'next'

// ISR: re-render at most every hour. Public marketing — no per-user data.
export const revalidate = 3600


export const metadata: Metadata = {
  title: 'Execution-Rail Partners | Vektrum',
  description:
    'Become a Vektrum Execution-Rail Partner. Title companies, escrow agents, and construction loan servicers integrate via webhook and partner API to execute authorized construction draw payments.',
  alternates: { canonical: 'https://vektrum.io/partners' },
  openGraph: {
    title: 'Execution-Rail Partners — Vektrum',
    description: 'Title companies, escrow agents, and loan servicers integrate via partner API to execute authorized construction draws.',
    url: 'https://vektrum.io/partners',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'Execution-Rail Partners — Vektrum',
    description: 'Title companies, escrow agents, and loan servicers integrate via partner API.',
  },
}

// ─── Code Block ───────────────────────────────────────────────────────────────

function CodeBlock({ children, language = 'json' }: { children: string; language?: string }) {
  return (
    <pre className={`language-${language} overflow-x-auto rounded-xl border border-white/[0.08] bg-[#070D18] p-5 text-[12.5px] leading-relaxed text-white/80 font-mono`}>
      <code>{children}</code>
    </pre>
  )
}

// ─── Step Card ─────────────────────────────────────────────────────────────────

function StepCard({
  number,
  title,
  body,
  icon: Icon,
}: {
  number: string
  title: string
  body: string
  icon: React.FC<{ size?: number; className?: string }>
}) {
  return (
    <div className="relative flex flex-col rounded-2xl border border-white/[0.08] bg-[#111827] p-7">
      <div className="absolute -top-3.5 -left-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-vektrum-blue text-[11px] font-bold text-white shadow-lg shadow-vektrum-blue/30">
        {number}
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/10 mb-4">
        <Icon size={18} className="text-blue-300" />
      </div>
      <h3 className="text-[15px] font-semibold text-white mb-2 leading-snug">{title}</h3>
      <p className="text-[13px] leading-relaxed text-white/55">{body}</p>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PartnersPage() {
  return (
    <div className="flex flex-col bg-[#0D1B2A]">

      {/* ─── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-vektrum-blue/12 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-vektrum-blue/30 bg-vektrum-blue/[0.07] px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-vektrum-blue" />
            <span className="text-[11px] font-bold text-blue-300 tracking-[0.14em] uppercase">
              Execution-Rail Partners
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-[52px] sm:leading-[1.06] text-balance mb-6">
            Become a Vektrum<br />
            Execution-Rail Partner
          </h1>

          <p className="mx-auto max-w-2xl text-[17px] leading-relaxed text-white/60 mb-10">
            Vektrum is the conditional authorization layer for construction draws. When all
            conditions pass, we fire a signed authorization signal to your endpoint. You execute
            the payment on your licensed rail. You retain full control of fund movement — Vektrum
            provides the governance, audit trail, and release signal.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <a
              href="mailto:partners@vektrum.io"
              className="group inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-8 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Contact us to become a partner
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <Link
              href="/partners/docs"
              className="inline-flex min-h-[50px] items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-8 py-3 text-[14px] font-semibold text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
            >
              View API reference
            </Link>
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────────────── */}
      <section className="bg-[#031226] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-blue-300 font-semibold">How it works</p>
              <div className="h-px w-5 bg-vektrum-blue" />
            </div>
            <h2 className="font-display text-[2.25rem] font-bold tracking-[-0.035em] text-white leading-[1.08]">
              Three steps from authorization to execution.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <StepCard
              number="1"
              icon={Shield}
              title="Funder authorizes a draw in Vektrum"
              body="The funder triggers a release for a specific milestone. Vektrum's 10-condition gate evaluates all conditions atomically — including AI draw review, lien waiver status, contract validity, and funded balance. If any condition fails, the release is blocked. If all 10 conditions pass, the release is authorized."
            />
            <StepCard
              number="2"
              icon={Zap}
              title="Vektrum fires a signed webhook to your endpoint"
              body="Vektrum immediately fires a signed release.authorized webhook to the endpoint you registered during partner setup. The payload includes the release ID, deal details, milestone details, amounts, and an idempotency key. The signature is an HMAC-SHA256 of the timestamp and raw body, using your partner-specific signing secret."
            />
            <StepCard
              number="3"
              icon={CheckCircle2}
              title="You execute and confirm via API"
              body="Your licensed system executes the payment on your rail — wire, ACH, check, or your treasury infrastructure. Once executed, you call POST /api/partner/releases/:id/confirm with the payment reference and method. Vektrum records the confirmation and settles the deal ledger. If execution fails, call POST /api/partner/releases/:id/fail."
            />
          </div>
        </div>
      </section>

      {/* ─── Webhook Payload ──────────────────────────────────────────────────── */}
      <section className="bg-[#0D1B2A] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-blue-300 font-semibold">Webhook payload</p>
            </div>
            <h2 className="font-display text-[2rem] font-bold tracking-[-0.03em] text-white leading-[1.08] mb-3">
              The release.authorized event
            </h2>
            <p className="text-[15px] leading-relaxed text-white/55 max-w-2xl">
              When all 10 conditions pass, Vektrum fires this payload to your registered webhook endpoint.
              All monetary amounts are in USD as a decimal number. The{' '}
              <code className="text-blue-300 text-[13px] bg-white/[0.06] px-1.5 py-0.5 rounded">idempotency_key</code>{' '}
              is a UUID stable for the lifetime of the release — safe to use as a deduplication key on retries.
            </p>
          </div>

          <CodeBlock language="json">{`{
  "event": "release.authorized",
  "api_version": "2026-04-25",
  "release_id": "uuid",
  "deal_id": "uuid",
  "deal_title": "123 Main St Construction",
  "milestone_id": "uuid",
  "milestone_title": "Foundation Complete",
  "amount": 50000,
  "fee_amount": 750,
  "retainage_amount": 5000,
  "net_to_contractor": 44250,
  "contractor_id": "uuid",
  "funder_id": "uuid",
  "authorized_at": "2026-04-25T14:00:00Z",
  "authorized_by": "uuid",
  "idempotency_key": "uuid"
}`}</CodeBlock>

          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-5 py-4">
            <p className="text-[13px] text-amber-300/80 leading-relaxed">
              <strong className="text-amber-300">Important:</strong> Always verify the webhook
              signature before processing. A request without a valid{' '}
              <code className="text-[12px] bg-white/[0.06] px-1 py-0.5 rounded">X-Vektrum-Signature</code>{' '}
              header must be rejected. See the signature verification section below.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Signature Verification ───────────────────────────────────────────── */}
      <section className="bg-[#031226] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-blue-300 font-semibold">Signature verification</p>
            </div>
            <h2 className="font-display text-[2rem] font-bold tracking-[-0.03em] text-white leading-[1.08] mb-3">
              Verify every webhook before processing.
            </h2>
            <p className="text-[15px] leading-relaxed text-white/55 max-w-2xl">
              Every outbound webhook is signed:{' '}
              <code className="text-blue-300 text-[13px] bg-white/[0.06] px-1.5 py-0.5 rounded">
                X-Vektrum-Signature: t=&lt;unix_ts&gt;,sha256=HMAC-SHA256(&lt;ts&gt;.&lt;body&gt;, secret)
              </code>
              . Enforce a 5-minute tolerance window on the timestamp to prevent replay attacks.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-blue-300 mb-3">TypeScript</p>
              <CodeBlock language="typescript">{`import crypto from 'crypto'

function verifyVektrumSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('='))
  )
  const ts = parts['t']
  const received = parts['sha256']
  if (!ts || !received) return false

  const age = Math.floor(Date.now() / 1000) - parseInt(ts, 10)
  if (Math.abs(age) > toleranceSeconds) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${ts}.\${rawBody}\`)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(received),
    Buffer.from(expected)
  )
}`}</CodeBlock>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-400 mb-3">Python</p>
              <CodeBlock language="python">{`import hmac, hashlib, time

def verify_vektrum_signature(
    raw_body: str,
    signature_header: str,
    secret: str,
    tolerance: int = 300
) -> bool:
    parts = dict(
        p.split("=", 1)
        for p in signature_header.split(",")
    )
    ts = parts.get("t")
    received = parts.get("sha256")
    if not ts or not received:
        return False
    if abs(time.time() - int(ts)) > tolerance:
        return False
    expected = hmac.new(
        secret.encode(),
        f"{ts}.{raw_body}".encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(received, expected)`}</CodeBlock>
            </div>
          </div>
        </div>
      </section>

      {/* ─── API Endpoints ────────────────────────────────────────────────────── */}
      <section className="bg-[#0D1B2A] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-blue-300 font-semibold">Partner API endpoints</p>
            </div>
            <h2 className="font-display text-[2rem] font-bold tracking-[-0.03em] text-white leading-[1.08] mb-3">
              Three endpoints. All authenticated with your API key.
            </h2>
            <p className="text-[15px] leading-relaxed text-white/55 max-w-2xl">
              Authenticate all requests with{' '}
              <code className="text-blue-300 text-[13px] bg-white/[0.06] px-1.5 py-0.5 rounded">
                Authorization: Bearer &lt;your_api_key&gt;
              </code>
              . API keys are prefixed{' '}
              <code className="text-blue-300 text-[13px] bg-white/[0.06] px-1.5 py-0.5 rounded">vkp_</code>{' '}
              and 68 characters total.
            </p>
          </div>

          <div className="space-y-6">

            {/* GET /api/partner/releases/:id */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-7">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  GET
                </span>
                <code className="text-[14px] font-mono text-white">/api/partner/releases/:id</code>
              </div>
              <p className="text-[13px] leading-relaxed text-white/60 mb-4">
                Fetch the current state of a release. Use this to poll for pending releases if you
                did not receive the webhook, or to confirm the release is still in{' '}
                <code className="text-[12px] bg-white/[0.06] px-1 py-0.5 rounded text-white/80">pending</code>{' '}
                state before executing payment.
              </p>
              <p className="text-[12px] font-semibold text-white/70 mb-2">Response 200:</p>
              <CodeBlock language="json">{`{
  "release": {
    "id": "uuid",
    "deal_id": "uuid",
    "deal_title": "string",
    "milestone_id": "uuid",
    "milestone_title": "string",
    "amount": 50000,
    "fee_amount": 750,
    "retainage_amount": 5000,
    "net_to_contractor": 44250,
    "execution_status": "pending | confirmed | failed",
    "execution_rail": "external_manual",
    "execution_notes": "string | null",
    "authorized_at": "ISO 8601"
  }
}`}</CodeBlock>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-2">
                  <code className="text-[11px] text-red-400">403</code>
                  <span className="text-[11px] text-white/55 ml-2">Deal not associated with your partner account</span>
                </div>
                <div className="rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-2">
                  <code className="text-[11px] text-red-400">404</code>
                  <span className="text-[11px] text-white/55 ml-2">Release not found</span>
                </div>
              </div>
            </div>

            {/* POST /api/partner/releases/:id/confirm */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-7">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-vektrum-blue/10 text-blue-300 border border-vektrum-blue/20">
                  POST
                </span>
                <code className="text-[14px] font-mono text-white">/api/partner/releases/:id/confirm</code>
              </div>
              <p className="text-[13px] leading-relaxed text-white/60 mb-4">
                Record that you have executed the authorized payment. Vektrum settles the deal
                ledger, inserts the billing record, and marks the release confirmed. Safe to retry
                — already-confirmed releases return 200 with{' '}
                <code className="text-[12px] bg-white/[0.06] px-1 py-0.5 rounded text-white/80">alreadyConfirmed: true</code>.
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="text-[12px] font-semibold text-white/70 mb-2">Request body:</p>
                  <CodeBlock language="json">{`{
  "payment_method": "wire | ach | check | other",
  "payment_reference": "string",
  "executed_at": "ISO 8601 (optional)",
  "notes": "string (optional)",
  "proof_document_id": "uuid (optional)"
}`}</CodeBlock>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-white/70 mb-2">Response 200:</p>
                  <CodeBlock language="json">{`{
  "success": true,
  "releaseId": "uuid",
  "execution_status": "confirmed",
  "alreadyConfirmed": true
}`}</CodeBlock>
                  <div className="mt-3 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2">
                    <code className="text-[11px] text-amber-400">409</code>
                    <span className="text-[11px] text-white/55 ml-2">State changed by a concurrent request</span>
                  </div>
                </div>
              </div>
            </div>

            {/* POST /api/partner/releases/:id/fail */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-7">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-vektrum-blue/10 text-blue-300 border border-vektrum-blue/20">
                  POST
                </span>
                <code className="text-[14px] font-mono text-white">/api/partner/releases/:id/fail</code>
              </div>
              <p className="text-[13px] leading-relaxed text-white/60 mb-4">
                Record that execution failed on your rail. Vektrum frees the reservation and
                records the reason. The authorization signal has been voided. Admin review is
                required to re-authorize.
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="text-[12px] font-semibold text-white/70 mb-2">Request body:</p>
                  <CodeBlock language="json">{`{
  "reason": "string (min 10 chars)"
}`}</CodeBlock>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-white/70 mb-2">Response 200:</p>
                  <CodeBlock language="json">{`{
  "success": true,
  "releaseId": "uuid",
  "execution_status": "failed",
  "reservation_cancelled": true
}`}</CodeBlock>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-6 text-center">
            <Link
              href="/partners/docs"
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-blue-300 hover:underline"
            >
              View full API reference
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Get Started ──────────────────────────────────────────────────────── */}
      <section className="bg-[#031226] py-20 sm:py-24 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 text-center">
          <div className="mb-6 inline-flex items-center gap-3">
            <div className="h-px w-5 bg-vektrum-blue" />
            <p className="text-[11px] tracking-[0.12em] uppercase text-blue-300 font-semibold">Get started</p>
            <div className="h-px w-5 bg-vektrum-blue" />
          </div>
          <h2 className="font-display text-[2.25rem] font-bold tracking-[-0.035em] text-white leading-[1.08] mb-5">
            Ready to integrate?
          </h2>
          <p className="text-[16px] leading-relaxed text-white/55 mb-8 max-w-xl mx-auto">
            Contact us to receive your partner API key and webhook signing secret. Credentials are
            issued once and shown only to the issuing admin. Once you have your credentials, you
            can begin testing against sandbox releases immediately.
          </p>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-8 py-8 mb-8">
            <div className="grid gap-4 sm:grid-cols-3 text-center sm:text-left sm:divide-x sm:divide-white/[0.06]">
              <div className="sm:pr-6">
                <FileText size={16} className="text-blue-300 mx-auto sm:mx-0 mb-2" aria-hidden="true" />
                <p className="text-[13px] font-semibold text-white mb-1">API key + secret</p>
                <p className="text-[12px] text-white/50 leading-relaxed">Issued by Vektrum admin. Shown once, stored as SHA-256 hash. Rotatable on demand.</p>
              </div>
              <div className="sm:px-6">
                <Zap size={16} className="text-blue-300 mx-auto sm:mx-0 mb-2" aria-hidden="true" />
                <p className="text-[13px] font-semibold text-white mb-1">Sandbox testing</p>
                <p className="text-[12px] text-white/50 leading-relaxed">Test confirm and fail endpoints with sandbox releases before going live.</p>
              </div>
              <div className="sm:pl-6">
                <Shield size={16} className="text-blue-300 mx-auto sm:mx-0 mb-2" aria-hidden="true" />
                <p className="text-[13px] font-semibold text-white mb-1">Audit trail</p>
                <p className="text-[12px] text-white/50 leading-relaxed">Every confirm and fail call is logged in the hash-chained audit log.</p>
              </div>
            </div>
          </div>

          <a
            href="mailto:partners@vektrum.io"
            className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-10 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 transition-all hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5"
          >
            Contact partners@vektrum.io
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </div>
      </section>

    </div>
  )
}
