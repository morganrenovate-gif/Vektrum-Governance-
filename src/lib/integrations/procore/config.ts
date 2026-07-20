export interface ProcoreConfig {
  clientId: string
  clientSecret: string
  authorizeUrl: string
  tokenUrl: string
  apiBaseUrl: string
  redirectUri: string
  companyId: string
  scopes?: string
  encryptionKey: string
  keyVersion: string
}

const DEVELOPER_SANDBOX_AUTHORIZE_URL = 'https://login-sandbox.procore.com/oauth/authorize'
const DEVELOPER_SANDBOX_TOKEN_URL = 'https://login-sandbox.procore.com/oauth/token'
const DEVELOPER_SANDBOX_API_URL = 'https://sandbox.procore.com'
const CALLBACK_PATH = '/api/integrations/procore/callback'

function requireExactUrl(value: string, expected: string, name: string): string {
  if (value !== expected) throw new Error(`${name} must be ${expected} for the Procore Developer Sandbox.`)
  return value
}

function validateRedirectUri(value: string): string {
  let uri: URL
  try { uri = new URL(value) } catch { throw new Error('PROCORE_REDIRECT_URI must be a valid URL.') }
  const isLocal = uri.protocol === 'http:' && uri.hostname === 'localhost' && uri.port === '3000'
  const isApprovedVektrumHost = uri.protocol === 'https:' && ['vektrum.io', 'www.vektrum.io'].includes(uri.hostname)
  if ((!isLocal && !isApprovedVektrumHost) || uri.pathname !== CALLBACK_PATH || uri.search || uri.hash) {
    throw new Error('PROCORE_REDIRECT_URI must be the approved Vektrum callback URL without query parameters.')
  }
  return uri.toString()
}

export function getProcoreConfig(): ProcoreConfig {
  const e = process.env
  if (e.PROCORE_INTEGRATION_ENABLED === 'false') throw new Error('Procore sandbox integration is disabled.')
  if (e.PROCORE_ENVIRONMENT !== 'sandbox' || e.PROCORE_WRITE_OPERATIONS_ENABLED !== 'false') {
    throw new Error('Procore must be sandbox-only with write operations disabled.')
  }
  const required = ['PROCORE_CLIENT_ID', 'PROCORE_CLIENT_SECRET', 'PROCORE_REDIRECT_URI', 'PROCORE_SANDBOX_COMPANY_ID', 'PROCORE_TOKEN_ENCRYPTION_KEY'] as const
  for (const name of required) if (!e[name]) throw new Error(`Missing ${name}.`)
  return {
    clientId: e.PROCORE_CLIENT_ID!, clientSecret: e.PROCORE_CLIENT_SECRET!,
    authorizeUrl: requireExactUrl(e.PROCORE_OAUTH_AUTHORIZE_URL ?? DEVELOPER_SANDBOX_AUTHORIZE_URL, DEVELOPER_SANDBOX_AUTHORIZE_URL, 'PROCORE_OAUTH_AUTHORIZE_URL'),
    tokenUrl: requireExactUrl(e.PROCORE_TOKEN_URL ?? DEVELOPER_SANDBOX_TOKEN_URL, DEVELOPER_SANDBOX_TOKEN_URL, 'PROCORE_TOKEN_URL'),
    apiBaseUrl: requireExactUrl(e.PROCORE_API_BASE_URL ?? DEVELOPER_SANDBOX_API_URL, DEVELOPER_SANDBOX_API_URL, 'PROCORE_API_BASE_URL'),
    redirectUri: validateRedirectUri(e.PROCORE_REDIRECT_URI!), companyId: e.PROCORE_SANDBOX_COMPANY_ID!,
    // Procore Developer Sandbox does not accept Vektrum's former generic
    // "read" default. Request a scope only when the app owner has configured
    // an official Procore scope for this OAuth client.
    scopes: e.PROCORE_SCOPES?.trim() || undefined, encryptionKey: e.PROCORE_TOKEN_ENCRYPTION_KEY!, keyVersion: e.PROCORE_TOKEN_ENCRYPTION_KEY_VERSION ?? '1',
  }
}
