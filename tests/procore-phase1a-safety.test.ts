import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
const migration=readFileSync('supabase/migrations/20260719000000_procore_sandbox_oauth.sql','utf8')
const client=readFileSync('src/lib/integrations/procore/client.ts','utf8')
const connect=readFileSync('src/app/api/integrations/procore/connect/route.ts','utf8')
assert.match(migration,/ENABLE ROW LEVEL SECURITY/g)
assert.doesNotMatch(migration,/CREATE POLICY/, 'Token storage must not expose an authenticated RLS policy')
assert.match(connect,/state_hash/)
assert.match(connect,/expires_at/)
assert.match(connect,/if\(c\.scopes\) url\.searchParams\.set\('scope',c\.scopes\)/, 'OAuth scope must be omitted unless explicitly configured')
assert.match(client,/\/rest\/v1\.0\/me/)
assert.doesNotMatch(client,/method:\s*['"](?:POST|PUT|PATCH|DELETE)/, 'Procore client must remain read-only')
console.log('Procore Phase 1A route and RLS safety tests passed')
