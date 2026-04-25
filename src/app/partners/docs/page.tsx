import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Partner API Reference | Vektrum',
  description:
    'Complete API reference for Vektrum execution-rail partners. Authentication, endpoints, webhook verification, error codes, and integration checklist.',
}

// ─── Code Block ───────────────────────────────────────────────────────────────

function CodeBlock({ children, language = 'json' }: { children: string; language?: string }) {
  return (
    <pre
      className={`language-${language} overflow-x-auto rounded-xl border border-white/[0.08] bg-[#070D18] p-5 text-[12.5px] leading-relaxed text-white/80 font-mono`}
    >
      <code>{children}</code>
    </pre>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-[1.6rem] font-bold tracking-[-0.025em] text-white border-b border-white/[0.06] pb-3 mb-6">
        {title}
      </h2>
      {children}
    </section>
  )
}

// ─── EndpointBlock ────────────────────────────────────────────────────────────

function EndpointBlock({
  method,
  path,
  description,
  children,
}: {
  method: 'GET' | 'POST'
  path: string
  description: string
  children: React.ReactNode
}) {
  const methodColors = {
    GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    POST: 'bg-vektrum-blue/10 text-vektrum-blue border-vektrum-blue/20',
  }
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-7 space-y-5">
      <div className="flex items-center gap-3">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border ${methodColors[method]}`}
        >
          {method}
        </span>
        <code className="text-[14px] font-mono text-white">{path}</code>
      </div>
      <p className="text-[14px] leading-relaxed text-white/60">{description}</p>
      {children}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PartnerDocsPage() {
  return (
    <div className="bg-[#0D1B2A] min-h-screen">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-20">

        {/* Header */}
        <div className="mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-vektrum-blue mb-3">
            Partner API Reference
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.035em] text-white mb-4">
            Vektrum Partner API
          </h1>
          <p className="text-[15px] leading-relaxed text-white/55 max-w-2xl">
            This document is the complete technical reference for Vektrum execution-rail partners.
            It covers authentication, all three partner API endpoints, webhook verification, error codes,
            and an integration checklist.
          </p>
          <p className="mt-4 text-[13px] text-white/40">
            API version: <code className="text-white/60">2026-04-25</code> — Base URL:{' '}
            <code className="text-white/60">https://app.vektrum.io</code>
          </p>
        </div>

        <div className="space-y-16">

          {/* ── Authentication ───────────────────────────────────────────────── */}
          <Section id="authentication" title="Authentication">
            <div className="space-y-4 text-[14px] leading-relaxed text-white/60">
              <p>
                All partner API endpoints require a partner API key passed as a Bearer token in the
                Authorization header:
              </p>
              <CodeBlock language="http">{`Authorization: Bearer vkp_<your_api_key>`}</CodeBlock>
              <p>
                Keys are prefixed <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">vkp_</code>{' '}
                and are 68 characters total. Only the SHA-256 hash is stored in Vektrum&apos;s database —
                the plaintext key is shown once at issuance and cannot be recovered. If you lose your
                key, an admin must rotate it (the previous key is immediately invalidated).
              </p>
              <p>
                To obtain your API key and webhook signing secret, contact{' '}
                <a href="mailto:partners@vektrum.com" className="text-vektrum-blue hover:underline">
                  partners@vektrum.com
                </a>
                . An admin will issue credentials via the Vektrum admin dashboard at{' '}
                <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">
                  /dashboard/admin/partners
                </code>
                .
              </p>
            </div>
          </Section>

          {/* ── Endpoints ────────────────────────────────────────────────────── */}
          <Section id="endpoints" title="Endpoints">
            <div className="space-y-8">

              {/* GET /api/partner/releases/:id */}
              <EndpointBlock
                method="GET"
                path="/api/partner/releases/:id"
                description="Fetch the current state of a release. Use this to poll for pending releases if you did not receive the webhook, or to confirm the release is still in pending state before executing payment. Partners can only access releases for deals associated with their partner account."
              >
                <div>
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
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-2.5">
                      <code className="text-[12px] text-red-400 font-mono">403</code>
                      <p className="text-[12px] text-white/55 mt-0.5">Deal not associated with your partner account</p>
                    </div>
                    <div className="rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-2.5">
                      <code className="text-[12px] text-red-400 font-mono">404</code>
                      <p className="text-[12px] text-white/55 mt-0.5">Release not found</p>
                    </div>
                  </div>
                </div>
              </EndpointBlock>

              {/* POST /api/partner/releases/:id/confirm */}
              <EndpointBlock
                method="POST"
                path="/api/partner/releases/:id/confirm"
                description="Record that you have executed the authorized payment on your rail. Vektrum settles the deal ledger, creates a billing record, and transitions the release to confirmed status. This endpoint is idempotent — if the release is already confirmed, it returns 200 with alreadyConfirmed: true and takes no further action. Safe to retry on network error."
              >
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="text-[12px] font-semibold text-white/70 mb-2">Request body:</p>
                    <CodeBlock language="json">{`{
  "payment_method": "wire | ach | check | other",
  "payment_reference": "string (wire ref, ACH trace, check number)",
  "executed_at": "ISO 8601 (optional, defaults to now)",
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
                    <div className="mt-3 space-y-2">
                      <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2.5">
                        <code className="text-[12px] text-amber-400 font-mono">409</code>
                        <p className="text-[12px] text-white/55 mt-0.5">State changed by a concurrent request</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/[0.04] px-4 py-3">
                  <p className="text-[12.5px] text-white/65 leading-relaxed">
                    <strong className="text-white">Idempotency:</strong> Already-confirmed releases
                    return 200 with <code className="text-[12px] bg-white/[0.06] px-1 py-0.5 rounded">alreadyConfirmed: true</code>.
                    If you receive a network timeout, retry with the same body — the second call
                    will detect the confirmed state and return safely.
                  </p>
                </div>
              </EndpointBlock>

              {/* POST /api/partner/releases/:id/fail */}
              <EndpointBlock
                method="POST"
                path="/api/partner/releases/:id/fail"
                description="Record that execution failed on your rail. Vektrum cancels the balance reservation, transitions the release to failed status, and records the reason in the audit log. The authorization signal is voided. Funder must re-authorize via the Vektrum dashboard if the payment is to be retried."
              >
                <div className="grid gap-6 lg:grid-cols-2">
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
              </EndpointBlock>

            </div>
          </Section>

          {/* ── Webhook Verification ─────────────────────────────────────────── */}
          <Section id="webhook-verification" title="Webhook Verification">
            <div className="space-y-5 text-[14px] leading-relaxed text-white/60">
              <p>
                Every outbound webhook from Vektrum includes an{' '}
                <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">X-Vektrum-Signature</code>{' '}
                header with this format:
              </p>
              <CodeBlock language="text">{`X-Vektrum-Signature: t=<unix_timestamp>,sha256=<hmac_hex>`}</CodeBlock>
              <p>
                The HMAC-SHA256 is computed over <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">&lt;timestamp&gt;.&lt;raw_body&gt;</code>{' '}
                using your partner-specific signing secret. The signing secret is distinct per
                partner and rotatable on demand via the admin dashboard.
              </p>
              <p>
                <strong className="text-white">Timestamp tolerance:</strong> Enforce a 5-minute
                (300-second) tolerance window on the{' '}
                <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">t</code>{' '}
                value. Reject any webhook where{' '}
                <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">|now() - t| &gt; 300</code>{' '}
                seconds. This prevents replay attacks — a captured webhook payload cannot be
                replayed after 5 minutes.
              </p>
              <p>
                <strong className="text-white">Timing-safe comparison:</strong> Always use a
                constant-time comparison (e.g. <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">crypto.timingSafeEqual</code>{' '}
                in Node.js or <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">hmac.compare_digest</code>{' '}
                in Python) to prevent timing side-channel attacks.
              </p>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-vektrum-blue mb-3">TypeScript</p>
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
          </Section>

          {/* ── Error Codes ──────────────────────────────────────────────────── */}
          <Section id="error-codes" title="Error Codes">
            <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
              <div className="grid grid-cols-[80px_1fr_2fr] border-b border-white/[0.08] bg-white/[0.02] px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Status</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Code</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Meaning in Vektrum context</span>
              </div>
              {[
                { status: '200', code: 'OK', meaning: 'Request succeeded. For confirm, check alreadyConfirmed field for idempotent re-submissions.' },
                { status: '400', code: 'Bad Request', meaning: 'Missing required field or invalid value. Check the errors array in the response body.' },
                { status: '401', code: 'Unauthorized', meaning: 'API key missing, malformed, or inactive. Verify your Authorization: Bearer header.' },
                { status: '403', code: 'Forbidden', meaning: 'Your partner account does not own the deal that contains this release.' },
                { status: '404', code: 'Not Found', meaning: 'Release ID does not exist, or the release belongs to a different partner.' },
                { status: '409', code: 'Conflict', meaning: 'A concurrent request changed the release state before yours completed. Fetch current state and retry if appropriate.' },
                { status: '422', code: 'Unprocessable', meaning: 'The release is not in the expected state for this operation (e.g. confirming an already-failed release).' },
                { status: '500', code: 'Internal Error', meaning: 'Vektrum server error. Retry with exponential backoff. If persistent, contact support.' },
              ].map((row, i) => (
                <div
                  key={row.status}
                  className={`grid grid-cols-[80px_1fr_2fr] px-5 py-3.5 border-b border-white/[0.04] last:border-0 ${
                    i % 2 === 1 ? 'bg-white/[0.013]' : ''
                  }`}
                >
                  <code className="text-[13px] font-mono text-white/80">{row.status}</code>
                  <span className="text-[13px] text-white/55">{row.code}</span>
                  <span className="text-[13px] text-white/55 leading-snug">{row.meaning}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Integration Checklist ────────────────────────────────────────── */}
          <Section id="integration-checklist" title="Integration Checklist">
            <p className="text-[14px] leading-relaxed text-white/55 mb-6">
              Before going live with a real release, verify each of the following:
            </p>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-7">
              <ul className="space-y-3">
                {[
                  'Received API key and webhook signing secret from Vektrum admin',
                  'Verified HMAC signature on a test webhook delivery',
                  'Confirmed GET /api/partner/releases/:id returns expected shape',
                  'Tested confirm endpoint with a sandbox release',
                  'Tested fail endpoint with a sandbox release',
                  'Set up idempotency handling (retry on network error, check alreadyConfirmed)',
                  'Enforced 5-minute timestamp tolerance on webhook verification',
                  'Confirmed audit log entries appear in Vektrum dashboard after confirm/fail calls',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded border border-white/[0.15] bg-white/[0.03]" />
                    <span className="text-[13.5px] text-white/65 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

        </div>

        {/* Footer note */}
        <div className="mt-16 pt-6 border-t border-white/[0.06]">
          <p className="text-[13px] text-white/40 leading-relaxed">
            Questions or issues? Contact{' '}
            <a href="mailto:partners@vektrum.com" className="text-vektrum-blue hover:underline">
              partners@vektrum.com
            </a>
            . API version 2026-04-25. This reference is updated with each API change.
          </p>
        </div>

      </div>
    </div>
  )
}
