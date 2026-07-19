import { NextRequest,NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/middleware'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
export async function GET(request:NextRequest){try{const {user}=await getAuthUser(request);const {data,error}=await createSupabaseAdminClient().from('procore_connections').select('status,environment,provider_display_name,verified_at,disconnected_at').eq('profile_id',user.id).eq('environment','sandbox').maybeSingle();if(error)throw error;return NextResponse.json({connection:data??{status:'disconnected',environment:'sandbox'}})}catch{return NextResponse.json({error:'Unable to load Procore status.'},{status:500})}}
