import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase';
import { serverEncrypt } from '@/lib/encryption';
import { validateApiKey, type ProviderId } from '@/lib/providers';

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { apiKey, provider = 'openai' } = await request.json();
    if (!apiKey || typeof apiKey !== 'string') return NextResponse.json({ error: 'API key is required' }, { status: 400 });

    // Validate key format for provider
    const validation = validateApiKey(provider as ProviderId, apiKey.trim());
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || 'Invalid API key format' }, { status: 400 });
    }

    const encryptedData = await serverEncrypt(apiKey.trim());
    const db = createServiceRoleClient();

    const { data, error } = await db
      .from('api_keys')
      .upsert({
        user_id: session.user.id,
        provider,
        encrypted_key: encryptedData.encryptedKey,
        iv: encryptedData.iv,
        tag: encryptedData.tag,
        salt: encryptedData.salt,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' })
      .select().single();

    if (error) return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });

    return NextResponse.json({
      success: true,
      message: 'API key saved successfully',
      data: { id: data.id, provider: data.provider, created_at: data.created_at },
    });
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

    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('api_keys')
      .select('id, provider, is_active, created_at, updated_at')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

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

    const { provider } = await request.json();
    if (!provider) return NextResponse.json({ error: 'Provider is required' }, { status: 400 });

    const db = createServiceRoleClient();
    const { error } = await db
      .from('api_keys')
      .delete()
      .eq('user_id', session.user.id)
      .eq('provider', provider);

    if (error) return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
    return NextResponse.json({ success: true, message: `${provider} key deleted` });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
