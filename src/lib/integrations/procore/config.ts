export interface ProcoreConfig { clientId: string; clientSecret: string; authorizeUrl: string; tokenUrl: string; apiBaseUrl: string; redirectUri: string; companyId: string; scopes: string; encryptionKey: string; keyVersion: string }

export function getProcoreConfig(): ProcoreConfig {
  const e = process.env
  // The sandbox configuration itself is the enablement contract. An explicit
  // false remains a hard kill switch, but requiring an additional undocumented
  // flag prevents a correctly configured sandbox from ever being usable.
  if (e.PROCORE_INTEGRATION_ENABLED === 'false') throw new Error('Procore sandbox integration is disabled.')
  if (e.PROCORE_ENVIRONMENT !== 'sandbox' || e.PROCORE_WRITE_OPERATIONS_ENABLED !== 'false') throw new Error('Procore must be sandbox-only with write operations disabled.')
  const required = ['PROCORE_CLIENT_ID','PROCORE_CLIENT_SECRET','PROCORE_OAUTH_AUTHORIZE_URL','PROCORE_REDIRECT_URI','PROCORE_SANDBOX_COMPANY_ID','PROCORE_TOKEN_ENCRYPTION_KEY'] as const
  for (const name of required) if (!e[name]) throw new Error(`Missing ${name}.`)
  if (e.PROCORE_REDIRECT_URI !== 'http://localhost:3000/api/integrations/procore/callback') throw new Error('Unexpected Procore redirect URI.')
  return { clientId:e.PROCORE_CLIENT_ID!, clientSecret:e.PROCORE_CLIENT_SECRET!, authorizeUrl:e.PROCORE_OAUTH_AUTHORIZE_URL!, tokenUrl:'https://login.procore.com/oauth/token', apiBaseUrl:'https://api.procore.com', redirectUri:e.PROCORE_REDIRECT_URI!, companyId:e.PROCORE_SANDBOX_COMPANY_ID!, scopes:e.PROCORE_SCOPES ?? 'read', encryptionKey:e.PROCORE_TOKEN_ENCRYPTION_KEY!, keyVersion:e.PROCORE_TOKEN_ENCRYPTION_KEY_VERSION ?? '1' }
}
