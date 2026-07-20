import { strict as assert } from 'node:assert'
import { hash, secret } from '../src/lib/integrations/procore/oauth'
import { encryptTokens, decryptAccess } from '../src/lib/integrations/procore/crypto'
import { getProcoreConfig } from '../src/lib/integrations/procore/config'

const key = Buffer.alloc(32, 7).toString('base64')
const state = secret()
assert.equal(hash(state) === state, false, 'OAuth state must be stored only as a hash')
assert.equal(hash(state), hash(state), 'OAuth state hashing must be deterministic for validation')
const encrypted = encryptTokens('access-token', 'refresh-token', key)
assert.equal(encrypted.access_token_ciphertext.includes('access-token'), false, 'Token ciphertext must not contain plaintext')
assert.equal(decryptAccess({ access_token_ciphertext: encrypted.access_token_ciphertext, token_iv: encrypted.token_iv, token_tag: encrypted.token_tag }, key), 'access-token')
assert.throws(() => decryptAccess({ access_token_ciphertext: encrypted.access_token_ciphertext, token_iv: encrypted.token_iv, token_tag: Buffer.alloc(16).toString('base64') }, key), 'Tampered token ciphertext must fail authentication')

const procoreEnv = {
  PROCORE_CLIENT_ID: 'test-client', PROCORE_CLIENT_SECRET: 'test-secret',
  PROCORE_OAUTH_AUTHORIZE_URL: 'https://login-sandbox.procore.com/oauth/authorize',
  PROCORE_TOKEN_URL: 'https://login-sandbox.procore.com/oauth/token',
  PROCORE_API_BASE_URL: 'https://sandbox.procore.com',
  PROCORE_REDIRECT_URI: 'http://localhost:3000/api/integrations/procore/callback',
  PROCORE_SANDBOX_COMPANY_ID: '4287207', PROCORE_TOKEN_ENCRYPTION_KEY: key,
  PROCORE_ENVIRONMENT: 'sandbox', PROCORE_WRITE_OPERATIONS_ENABLED: 'false',
}
const previousEnv = Object.fromEntries(Object.keys(procoreEnv).map((name) => [name, process.env[name]]))
Object.assign(process.env, procoreEnv)
assert.equal(getProcoreConfig().companyId, '4287207', 'Valid sandbox configuration must not require an undocumented enablement flag')
assert.equal(getProcoreConfig().tokenUrl, 'https://login-sandbox.procore.com/oauth/token', 'Developer Sandbox token URL must be used')
assert.equal(getProcoreConfig().scopes, undefined, 'No unverified OAuth scope must be sent by default')
process.env.PROCORE_REDIRECT_URI = 'https://vektrum.io/api/integrations/procore/callback'
assert.equal(getProcoreConfig().redirectUri, 'https://vektrum.io/api/integrations/procore/callback', 'Approved deployed callback must be accepted')
process.env.PROCORE_INTEGRATION_ENABLED = 'false'
assert.throws(() => getProcoreConfig(), /disabled/, 'An explicit false flag remains a fail-closed kill switch')
for (const [name, value] of Object.entries(previousEnv)) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
console.log('Procore OAuth security tests passed')
