import { getProcoreConfig } from './config'
export type ProcoreProject = { id:string; name:string; number:string|null; status:string|null; address:string|null }
function text(value: unknown): string | null { return typeof value === 'string' ? value : value == null ? null : String(value) }
async function read(path:string, token:string, companyId:string) {
  const c=getProcoreConfig(); const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),10_000)
  try { const res=await fetch(`${c.apiBaseUrl}${path}`,{headers:{Authorization:`Bearer ${token}`,'Procore-Company-Id':companyId},cache:'no-store',signal:controller.signal}); if(!res.ok) throw new Error(`Procore read failed (${res.status}).`); return await res.json() as unknown } finally { clearTimeout(timeout) }
}
export async function verifyIdentity(token:string) { const c=getProcoreConfig(); const body=await read('/rest/v1.0/me',token,c.companyId) as Record<string,unknown>; return { subject:text(body.id) ?? text(body.user_id) ?? '', displayName:text(body.name) ?? text(body.login) ?? text(body.email) ?? 'Verified Procore user' } }
export async function listProjects(token:string, companyId:string):Promise<ProcoreProject[]> { const body=await read(`/rest/v1.1/projects?company_id=${encodeURIComponent(companyId)}`,token,companyId); if(!Array.isArray(body)) throw new Error('Procore projects response was not a list.'); return body.map((item)=>{const p=item as Record<string,unknown>; return {id:String(p.id),name:text(p.name) ?? 'Untitled project',number:text(p.project_number) ?? text(p.number),status:text(p.status),address:text(p.address)}}) }
