import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
const page=readFileSync('src/app/(app)/dashboard/funder/integrations/procore/page.tsx','utf8')
const dashboard=readFileSync('src/app/(app)/dashboard/page.tsx','utf8')
const contractorBranch=dashboard.slice(dashboard.indexOf("if (profile.role === 'contractor')"),dashboard.indexOf('// ── Funder view'))
const api=['connect','status','disconnect'].map(n=>readFileSync(`src/app/api/integrations/procore/${n}/route.ts`,'utf8')).join('\n')
const ui=readFileSync('src/components/settings/procore-sandbox-tab.tsx','utf8')
assert.match(page,/role !== 'funder'/, 'Direct integration route must deny non-funders server-side')
assert.match(api,/requireRole\(profile, ?'funder'\)/, 'API routes must enforce funder role server-side')
assert.match(dashboard,/ProcoreIntegrationCard/, 'Funder dashboard must render integration card')
assert.doesNotMatch(contractorBranch,/ProcoreIntegrationCard/, 'Contractor dashboard must not render integration card')
for(const text of ['Live Procore Development Sandbox','Read-only','Write operations disabled','Vektrum does not hold, move, or execute funds','AI does not approve or authorize a release']) assert.match(ui,new RegExp(text.replace(/[.?]/g,'\\$&')))
assert.doesNotMatch(ui,/access_token|refresh_token|client_secret/i, 'Connection UI must not render secrets')
console.log('Procore funder access tests passed')
