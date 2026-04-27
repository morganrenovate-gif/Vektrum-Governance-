/**
 * Production environment validator.
 *
 * Pure function — takes an env-shaped object (defaulting to process.env) and
 * returns a structured report of missing, malformed, or unsafe configuration.
 *
 * Why a pure function rather than throwing at module load:
 *   - Throwing on import would break Vercel builds (some vars are populated at
 *     runtime, not build time) and break local dev when developers run with a
 *     partial .env.local.
 *   - Throwing in middleware would 500 every request the moment one variable
 *     is missing — a failure mode worse than the configuration gap.
 *   - The diagnostic route at /api/admin/env-health and the CLI shim at
 *     scripts/check-prod-env.mjs both call this validator. The route is the
 *     "ops can poll any time" surface; the CLI is the "fail loud during deploy"
 *     surface. Coupling is intentional.
 *
 * Secret values are never returned. Reports describe presence, length, and
 * shape — never the value itself.
 */

export type Severity = 'error' | 'warning'

export interface ValidationFinding {
  variable: string
  severity: Severity
  message: string
  category:
    | 'supabase'
    | 'stripe'
    | 'docusign'
    | 'cron'
    | 'admin'
    | 'ai'
    | 'email'
    | 'app'
    | 'partner_api'
}

export interface ValidationReport {
  ok: boolean
  environment: 'production' | 'development' | 'test' | 'unknown'
  errors: ValidationFinding[]
  warnings: ValidationFinding[]
  /** Redacted variable summary (presence + length only — no values). */
  variables: Record<string, { present: boolean; length: number }>
}

type EnvLike = Record<string, string | undefined>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPresent(v: string | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isPlausibleUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function isPlausibleHostname(v: string): boolean {
  // Matches account-d.docusign.com, account.docusign.com, and similar.
  // Disallows protocol prefix and path — it is a hostname only.
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v) && !v.includes('/') && !v.includes(' ')
}

function isPlausibleBase64(v: string): boolean {
  // base64 / base64url; allow newlines/whitespace which are common when copying PEM.
  const stripped = v.replace(/\s+/g, '')
  return stripped.length >= 64 && /^[A-Za-z0-9+/=_-]+$/.test(stripped)
}

/** IPv4 CIDR or exact IPv4. Mirrors src/middleware.ts ipv4ToInt + isIpInCidr. */
function isPlausibleIpv4OrCidr(v: string): boolean {
  const trimmed = v.trim()
  const [ip, prefixStr] = trimmed.includes('/') ? trimmed.split('/') : [trimmed, undefined]
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  for (const p of parts) {
    const n = Number(p)
    if (!Number.isInteger(n) || n < 0 || n > 255 || p !== String(n)) return false
  }
  if (prefixStr !== undefined) {
    const prefix = Number(prefixStr)
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32 || prefixStr !== String(prefix)) return false
  }
  return true
}

function startsWith(v: string, prefix: string): boolean {
  return v.startsWith(prefix)
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validate a snapshot of environment variables against Vektrum's production
 * requirements. Defaults to process.env. Pass an explicit env object to test.
 *
 * Behavior is governed by env.NODE_ENV:
 *   - 'production'              → all critical vars are required (errors if missing)
 *   - 'development' | 'test'    → critical vars are warnings, not errors
 *                                 (so local dev with partial config still passes)
 *   - anything else             → treated as 'unknown' (warnings only)
 *
 * Optional/conditional vars (e.g. ADMIN_ALLOWED_IPS) are validated for shape
 * IF they are set, regardless of NODE_ENV.
 */
export function validateProductionEnv(envOverride?: EnvLike): ValidationReport {
  const env = envOverride ?? (process.env as EnvLike)
  const nodeEnv = env.NODE_ENV
  const environment: ValidationReport['environment'] =
    nodeEnv === 'production' || nodeEnv === 'development' || nodeEnv === 'test'
      ? nodeEnv
      : 'unknown'
  const isProd = environment === 'production'

  const errors: ValidationFinding[] = []
  const warnings: ValidationFinding[] = []

  // sev() picks 'error' in production, 'warning' otherwise — this is the
  // single mechanism that keeps local dev usable while still surfacing gaps.
  const sev = (): Severity => (isProd ? 'error' : 'warning')

  function record(finding: Omit<ValidationFinding, 'severity'> & { severity?: Severity }) {
    const f: ValidationFinding = { severity: finding.severity ?? sev(), ...finding } as ValidationFinding
    if (f.severity === 'error') errors.push(f)
    else warnings.push(f)
  }

  // ── Required (critical in production) ──────────────────────────────────────

  // Supabase
  const supabaseUrl     = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseSrvKey  = env.SUPABASE_SERVICE_ROLE_KEY

  if (!isPresent(supabaseUrl)) {
    record({ variable: 'NEXT_PUBLIC_SUPABASE_URL', category: 'supabase',
      message: 'Missing. The app cannot reach Supabase without it.' })
  } else if (!isPlausibleUrl(supabaseUrl)) {
    record({ variable: 'NEXT_PUBLIC_SUPABASE_URL', category: 'supabase', severity: 'error',
      message: 'Set but not a valid http(s) URL.' })
  }

  if (!isPresent(supabaseAnonKey)) {
    record({ variable: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', category: 'supabase',
      message: 'Missing. SSR session checks will fail.' })
  } else if (supabaseAnonKey.length < 40) {
    record({ variable: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', category: 'supabase', severity: 'warning',
      message: 'Set but suspiciously short — verify it is the full anon key.' })
  }

  if (!isPresent(supabaseSrvKey)) {
    record({ variable: 'SUPABASE_SERVICE_ROLE_KEY', category: 'supabase',
      message: 'Missing. Audit log writes, admin actions, and cron jobs will fail.' })
  } else if (supabaseSrvKey === supabaseAnonKey) {
    record({ variable: 'SUPABASE_SERVICE_ROLE_KEY', category: 'supabase', severity: 'error',
      message: 'Equal to the anon key — service-role privileges are NOT in effect. Set the JWT with role=service_role.' })
  } else if (supabaseSrvKey.length < 40) {
    record({ variable: 'SUPABASE_SERVICE_ROLE_KEY', category: 'supabase', severity: 'warning',
      message: 'Set but suspiciously short — verify it is the full service-role JWT.' })
  }

  // Stripe
  const stripeSecret  = env.STRIPE_SECRET_KEY
  const stripeWhSec   = env.STRIPE_WEBHOOK_SECRET

  if (!isPresent(stripeSecret)) {
    record({ variable: 'STRIPE_SECRET_KEY', category: 'stripe',
      message: 'Missing. The Stripe rail (transfers, Connect onboarding, payouts) is non-functional.' })
  } else if (!startsWith(stripeSecret, 'sk_')) {
    record({ variable: 'STRIPE_SECRET_KEY', category: 'stripe', severity: 'error',
      message: "Set but does not start with 'sk_' — does not look like a Stripe secret key." })
  } else if (isProd && startsWith(stripeSecret, 'sk_test_')) {
    record({ variable: 'STRIPE_SECRET_KEY', category: 'stripe', severity: 'error',
      message: "NODE_ENV=production but key is 'sk_test_*' — production must use a live key." })
  }

  if (!isPresent(stripeWhSec)) {
    record({ variable: 'STRIPE_WEBHOOK_SECRET', category: 'stripe',
      message: 'Missing. Stripe webhook HMAC verification will reject every event.' })
  } else if (!startsWith(stripeWhSec, 'whsec_')) {
    record({ variable: 'STRIPE_WEBHOOK_SECRET', category: 'stripe', severity: 'error',
      message: "Set but does not start with 'whsec_' — does not look like a Stripe webhook signing secret." })
  }

  // Cron
  const cronSecret = env.CRON_SECRET
  if (!isPresent(cronSecret)) {
    record({ variable: 'CRON_SECRET', category: 'cron',
      message: 'Missing. /api/cron/reconcile rejects all callers in production when this is unset.' })
  } else if (cronSecret.length < 24) {
    record({ variable: 'CRON_SECRET', category: 'cron', severity: 'error',
      message: 'Set but shorter than 24 chars — use a high-entropy random secret.' })
  }

  // App URL — used by Stripe onboarding refresh/return URLs and email links.
  const appUrl       = env.APP_URL
  const publicAppUrl = env.NEXT_PUBLIC_APP_URL
  if (!isPresent(appUrl) && !isPresent(publicAppUrl)) {
    record({ variable: 'APP_URL', category: 'app', severity: isProd ? 'warning' : 'warning',
      message: 'Neither APP_URL nor NEXT_PUBLIC_APP_URL is set. Stripe onboarding redirects and email deep-links may break.' })
  } else {
    for (const [name, val] of [['APP_URL', appUrl], ['NEXT_PUBLIC_APP_URL', publicAppUrl]] as const) {
      if (isPresent(val) && !isPlausibleUrl(val)) {
        record({ variable: name, category: 'app', severity: 'error',
          message: 'Set but not a valid http(s) URL.' })
      }
    }
  }

  // Email (Resend) — receipts, invites, contract-signing notifications.
  const resendKey = env.RESEND_API_KEY
  if (!isPresent(resendKey)) {
    record({ variable: 'RESEND_API_KEY', category: 'email', severity: isProd ? 'warning' : 'warning',
      message: 'Missing. Receipt emails, invites, and notifications will not be delivered.' })
  } else if (!startsWith(resendKey, 're_')) {
    record({ variable: 'RESEND_API_KEY', category: 'email', severity: 'warning',
      message: "Set but does not start with 're_' — verify it is a real Resend key." })
  }

  // ── DocuSign — required if contract signing is in use ───────────────────────
  // All-or-nothing: if ANY DocuSign var is set, all of them should be set,
  // because src/lib/engine/docusign.ts will throw on the first missing one
  // and leave the contract route in a half-configured state.
  const docusignVars = {
    DOCUSIGN_INTEGRATION_KEY: env.DOCUSIGN_INTEGRATION_KEY,
    DOCUSIGN_USER_ID:         env.DOCUSIGN_USER_ID,
    DOCUSIGN_ACCOUNT_ID:      env.DOCUSIGN_ACCOUNT_ID,
    DOCUSIGN_PRIVATE_KEY:     env.DOCUSIGN_PRIVATE_KEY,
    DOCUSIGN_BASE_PATH:       env.DOCUSIGN_BASE_PATH,
    DOCUSIGN_OAUTH_HOST:      env.DOCUSIGN_OAUTH_HOST,
    DOCUSIGN_WEBHOOK_SECRET:  env.DOCUSIGN_WEBHOOK_SECRET,
  }
  const docusignSetCount = Object.values(docusignVars).filter(isPresent).length
  const docusignAnySet   = docusignSetCount > 0
  const docusignAllSet   = docusignSetCount === Object.keys(docusignVars).length

  // In production, treat DocuSign as required (contracts are core).
  // In dev, only complain if partially configured.
  if (isProd || docusignAnySet) {
    if (!isPresent(docusignVars.DOCUSIGN_INTEGRATION_KEY)) {
      record({ variable: 'DOCUSIGN_INTEGRATION_KEY', category: 'docusign',
        severity: isProd ? 'error' : 'warning',
        message: 'Missing. DocuSign contract signing will fail at envelope creation.' })
    }
    if (!isPresent(docusignVars.DOCUSIGN_USER_ID)) {
      record({ variable: 'DOCUSIGN_USER_ID', category: 'docusign',
        severity: isProd ? 'error' : 'warning',
        message: 'Missing. JWT impersonation requires the DocuSign user UUID.' })
    }
    if (!isPresent(docusignVars.DOCUSIGN_ACCOUNT_ID)) {
      record({ variable: 'DOCUSIGN_ACCOUNT_ID', category: 'docusign',
        severity: isProd ? 'error' : 'warning',
        message: 'Missing. Required to scope envelope operations to the correct DocuSign account.' })
    }
    if (!isPresent(docusignVars.DOCUSIGN_PRIVATE_KEY)) {
      record({ variable: 'DOCUSIGN_PRIVATE_KEY', category: 'docusign',
        severity: isProd ? 'error' : 'warning',
        message: 'Missing. Required to sign DocuSign JWTs (base64-encoded RSA private key).' })
    } else if (!isPlausibleBase64(docusignVars.DOCUSIGN_PRIVATE_KEY!)) {
      record({ variable: 'DOCUSIGN_PRIVATE_KEY', category: 'docusign', severity: 'error',
        message: 'Set but does not look base64-encoded. Encode the PEM with: base64 -i key.pem | tr -d "\\n".' })
    }
    if (!isPresent(docusignVars.DOCUSIGN_BASE_PATH)) {
      record({ variable: 'DOCUSIGN_BASE_PATH', category: 'docusign',
        severity: isProd ? 'error' : 'warning',
        message: "Missing. Set to https://www.docusign.net/restapi (live) or https://demo.docusign.net/restapi (sandbox)." })
    } else if (!isPlausibleUrl(docusignVars.DOCUSIGN_BASE_PATH!)) {
      record({ variable: 'DOCUSIGN_BASE_PATH', category: 'docusign', severity: 'error',
        message: 'Set but not a valid http(s) URL.' })
    } else if (isProd && /demo\.docusign\.net/i.test(docusignVars.DOCUSIGN_BASE_PATH!)) {
      record({ variable: 'DOCUSIGN_BASE_PATH', category: 'docusign', severity: 'error',
        message: 'NODE_ENV=production but pointing at the DocuSign sandbox (demo.docusign.net). Use https://www.docusign.net/restapi for live envelopes.' })
    }
    if (!isPresent(docusignVars.DOCUSIGN_OAUTH_HOST)) {
      record({ variable: 'DOCUSIGN_OAUTH_HOST', category: 'docusign',
        severity: isProd ? 'error' : 'warning',
        message: "Missing. Set to account.docusign.com (live) or account-d.docusign.com (sandbox)." })
    } else if (!isPlausibleHostname(docusignVars.DOCUSIGN_OAUTH_HOST!)) {
      record({ variable: 'DOCUSIGN_OAUTH_HOST', category: 'docusign', severity: 'error',
        message: 'Set but not a valid hostname (no protocol, no path).' })
    }
    if (!isPresent(docusignVars.DOCUSIGN_WEBHOOK_SECRET)) {
      record({ variable: 'DOCUSIGN_WEBHOOK_SECRET', category: 'docusign',
        severity: isProd ? 'error' : 'warning',
        message: 'Missing. /api/webhooks/docusign rejects all events when this is unset (unless DOCUSIGN_WEBHOOK_DEV_BYPASS=true in dev).' })
    } else if (docusignVars.DOCUSIGN_WEBHOOK_SECRET!.length < 24) {
      record({ variable: 'DOCUSIGN_WEBHOOK_SECRET', category: 'docusign', severity: 'warning',
        message: 'Set but shorter than 24 chars — use a high-entropy random secret.' })
    }
  }
  if (docusignAnySet && !docusignAllSet) {
    record({ variable: 'DOCUSIGN_*', category: 'docusign', severity: 'error',
      message: `Partial DocuSign configuration: ${docusignSetCount}/${Object.keys(docusignVars).length} variables set. ` +
               'Either set all DocuSign variables or unset them all — half-configured DocuSign throws inside the contract route.' })
  }

  // ── AI provider — at least one must be present in production ────────────────
  const anthropic = env.ANTHROPIC_API_KEY
  const openai    = env.OPENAI_API_KEY
  if (!isPresent(anthropic) && !isPresent(openai)) {
    record({ variable: 'ANTHROPIC_API_KEY', category: 'ai',
      severity: isProd ? 'error' : 'warning',
      message: 'Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set. AI draw review and contract analysis will fail.' })
  }

  // ── Optional / conditional — validate IF set ────────────────────────────────

  // ADMIN_ALLOWED_IPS: comma-separated CIDR/IP list.
  // If set in production, every entry must be parseable.
  const allowedIps = env.ADMIN_ALLOWED_IPS
  if (isPresent(allowedIps)) {
    const entries = allowedIps.split(',').map(s => s.trim()).filter(Boolean)
    if (entries.length === 0) {
      record({ variable: 'ADMIN_ALLOWED_IPS', category: 'admin', severity: 'warning',
        message: 'Set to an empty/whitespace-only string. Either remove it or add real CIDRs/IPs.' })
    } else {
      const bad = entries.filter(e => !isPlausibleIpv4OrCidr(e))
      if (bad.length > 0) {
        record({ variable: 'ADMIN_ALLOWED_IPS', category: 'admin', severity: 'error',
          message: `Contains ${bad.length} unparseable entr${bad.length === 1 ? 'y' : 'ies'} (expected IPv4 or IPv4/CIDR). ` +
                   `First bad entry begins with: '${bad[0].slice(0, 4)}…'` })
      }
    }
  } else if (isProd) {
    record({ variable: 'ADMIN_ALLOWED_IPS', category: 'admin', severity: 'warning',
      message: 'Unset in production — admin endpoints have no IP restriction. Acceptable if you rely on MFA + JWT only, but consider adding a CIDR allowlist.' })
  }

  // ADMIN_PROMOTION_ENABLED: must NOT be 'true' by default in production.
  // (App reads with !== "true" check, so unset == disabled, which is correct.)
  const promote = env.ADMIN_PROMOTION_ENABLED
  if (isProd && promote === 'true') {
    record({ variable: 'ADMIN_PROMOTION_ENABLED', category: 'admin', severity: 'error',
      message: 'Set to "true" in production. Admin promotion must be disabled by default — only flip on for the duration of a deliberate promote operation.' })
  }

  // SUPABASE_AUTH_WEBHOOK_SECRET — optional today; warn in prod if absent.
  const supaAuthWh = env.SUPABASE_AUTH_WEBHOOK_SECRET
  if (isProd && !isPresent(supaAuthWh)) {
    record({ variable: 'SUPABASE_AUTH_WEBHOOK_SECRET', category: 'supabase', severity: 'warning',
      message: 'Unset in production. /api/auth/webhook will not verify Supabase auth events.' })
  }

  // ── Build redacted variables summary ────────────────────────────────────────
  const tracked = [
    'NODE_ENV',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_AUTH_WEBHOOK_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'CRON_SECRET',
    'APP_URL',
    'NEXT_PUBLIC_APP_URL',
    'RESEND_API_KEY',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'ADMIN_ALLOWED_IPS',
    'ADMIN_PROMOTION_ENABLED',
    'DOCUSIGN_INTEGRATION_KEY',
    'DOCUSIGN_USER_ID',
    'DOCUSIGN_ACCOUNT_ID',
    'DOCUSIGN_PRIVATE_KEY',
    'DOCUSIGN_BASE_PATH',
    'DOCUSIGN_OAUTH_HOST',
    'DOCUSIGN_WEBHOOK_SECRET',
  ] as const

  const variables: ValidationReport['variables'] = {}
  for (const name of tracked) {
    const v = env[name]
    variables[name] = { present: isPresent(v), length: isPresent(v) ? v.length : 0 }
  }

  return {
    ok: errors.length === 0,
    environment,
    errors,
    warnings,
    variables,
  }
}
