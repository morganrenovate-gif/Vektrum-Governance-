import { createHash, randomBytes } from 'node:crypto'
export const hash = (v:string) => createHash('sha256').update(v).digest('hex')
export const secret = () => randomBytes(32).toString('base64url')
export const challenge = (verifier:string) => createHash('sha256').update(verifier).digest('base64url')
