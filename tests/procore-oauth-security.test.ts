import { strict as assert } from 'node:assert'
import { hash, secret } from '../src/lib/integrations/procore/oauth'
import { encryptTokens, decryptAccess } from '../src/lib/integrations/procore/crypto'

const key = Buffer.alloc(32, 7).toString('base64')
const state = secret()
assert.equal(hash(state) === state, false, 'OAuth state must be stored only as a hash')
assert.equal(hash(state), hash(state), 'OAuth state hashing must be deterministic for validation')
const encrypted = encryptTokens('access-token', 'refresh-token', key)
assert.equal(encrypted.access_token_ciphertext.includes('access-token'), false, 'Token ciphertext must not contain plaintext')
assert.equal(decryptAccess({ access_token_ciphertext: encrypted.access_token_ciphertext, token_iv: encrypted.token_iv, token_tag: encrypted.token_tag }, key), 'access-token')
assert.throws(() => decryptAccess({ access_token_ciphertext: encrypted.access_token_ciphertext, token_iv: encrypted.token_iv, token_tag: Buffer.alloc(16).toString('base64') }, key), 'Tampered token ciphertext must fail authentication')
console.log('Procore OAuth security tests passed')
