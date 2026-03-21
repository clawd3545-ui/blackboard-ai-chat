import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase';
import { serverEncrypt } from '@/lib/encryption';

function validateOpenAIKey(key: string): boolean { return key.startsWith('sk-') && key.length >= 40; }

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { apiKey, provider = 'openai' } = await request.json();
    if (!apiKey || typeof apiKey !== 'string') return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    if (provider === 'openai' && !validateOpenAIKey(apiKey)) return NextResponse.json({ error: 'Invalid API key format', message: 'OpenAI API keys should start with "sk-"' }, { status: 400 });
    const encryptedData = await serverEncrypt(apiKey);
    const serviceClient = createServiceRoleClient();
    const { data, error } = await serviceClient.from('api_keys').upsert({ user_id: session.user.id, provider, encrypted_key: encryptedData.encryptedKey, iv: encryptedData.iv, tag: encryptedData.tag, salt: encryptedData.salt, is_active: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id,provider' }).select().single();
    if (error) return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
    return NextResponse.json({ success: true, message: 'API key saved successfully', data: { id: data.id, provider: data.provider, created_at: data.created_at } });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const serviceClient = createServiceRoleClient();
    const { data, error } = await serviceClient.from('api_keys').select('id, provider, is_active, created_at, updated_at').eq('user_id', session.user.id).eq('is_active', true);
    if (error) return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
    return NextResponse.json({ keys: data || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { provider = 'openai' } = await request.json();
    const serviceClient = createServiceRoleClient();
    const { error } = await serviceClient.from('api_keys').delete().eq('user_id', session.user.id).eq('provider', provider);
    if (error) return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
    return NextResponse.json({ success: true, message: 'API key deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
