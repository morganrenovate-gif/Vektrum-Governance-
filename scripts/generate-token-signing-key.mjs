#!/usr/bin/env node
/**
 * scripts/generate-token-signing-key.mjs
 *
 * Generates an ed25519 keypair for Vektrum authorization-token signing.
 *
 * Usage:
 *   node scripts/generate-token-signing-key.mjs
 *
 * Output:
 *   - Prints VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE (base64 DER — single-line, safe for env vars)
 *   - Prints VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC  (PEM — for the partner verifier endpoint)
 *   - Saves the public key to vektrum-token-signing-key.pub.pem in the project root
 *
 * Store the PRIVATE key in your secret manager (Vercel env vars, Doppler, etc.).
 * Never commit the private key to source control.
 *
 * The private key value you set in VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE must be the
 * base64-encoded PKCS8 DER output printed below (single line, no whitespace).
 */

import { generateKeyPairSync } from 'node:crypto'
import { writeFileSync }        from 'node:fs'
import { resolve }              from 'node:path'

const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
})

const privateKeyB64 = privateKey.toString('base64')
const publicKeyPem  = publicKey

// Save public key to a file for reference (safe to commit or share with partners)
const pubKeyPath = resolve(process.cwd(), 'vektrum-token-signing-key.pub.pem')
writeFileSync(pubKeyPath, publicKeyPem, 'utf-8')

console.log('')
console.log('══════════════════════════════════════════════════════════════════')
console.log('  Vektrum Authorization-Token Signing Key')
console.log('══════════════════════════════════════════════════════════════════')
console.log('')
console.log('▶  PRIVATE KEY — set this as an environment variable')
console.log('   Store in Vercel environment variables, Doppler, or your secret manager.')
console.log('   NEVER commit to source control.')
console.log('')
console.log(`VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE=${privateKeyB64}`)
console.log('')
console.log('▶  PUBLIC KEY — for the partner verifier endpoint (safe to share)')
console.log(`   Saved to: ${pubKeyPath}`)
console.log('')
console.log(publicKeyPem)
console.log('══════════════════════════════════════════════════════════════════')
console.log('')
console.log('Next steps:')
console.log('  1. Copy the VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE line above.')
console.log('  2. Add it to Vercel: Settings → Environment Variables → Production.')
console.log('  3. Redeploy. All new tokens will be ed25519-signed.')
console.log('  4. Keep the public key PEM — the partner verifier endpoint will use it')
console.log('     when Tier B step 2 ships.')
console.log('')
