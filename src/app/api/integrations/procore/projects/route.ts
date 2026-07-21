import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { decryptAccess } from '@/lib/integrations/procore/crypto'
import { getProcoreConfig } from '@/lib/integrations/procore/config'
import { listProjects } from '@/lib/integrations/procore/client'
export async function GET(request:NextRequest){try{const {user,profile}=await getAuthUser(request);requireRole(profile,'funder');const admin=createSupabaseAdminClient();const {data:connection,error}=await admin.from('procore_connections').select('access_token_ciphertext,token_iv,token_tag,procore_company_id,status,reconnect_required').eq('profile_id',user.id).eq('environment','sandbox').single();if(error||!connection||connection.status!=='connected'||connection.reconnect_required)return NextResponse.json({error:'Reconnect Procore before loading projects.'},{status:409});const c=getProcoreConfig();const companyId=connection.procore_company_id??c.companyId;const projects=await listProjects(decryptAccess(connection,c.encryptionKey),companyId);return NextResponse.json({companyId,projects})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to load Procore projects.'},{status:500})}}
