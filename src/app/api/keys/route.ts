import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createServiceRoleClient } from '@/lib/supabase';
import { serverEncrypt } from '@/lib/encryption';
import { validateApiKey, type ProviderId } from '@/lib/providers';

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  try {
    const [user, body] = await Promise.all([
      getAuthUser(request, response),
      request.json(),
    ]);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { apiKey, provider = 'openai' } = body;
    if (!apiKey?.trim()) return NextResponse.json({ error: 'API key is required' }, { status: 400 });

    const validation = validateApiKey(provider as ProviderId, apiKey.trim());
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });

    const encryptedData = await serverEncrypt(apiKey.trim());
    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('api_keys')
      .upsert({
        user_id: user.id,
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
    return NextResponse.json({ success: true, data: { id: data.id, provider: data.provider } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  try {
    const user = await getAuthUser(request, response);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('api_keys')
      .select('id, provider, is_active, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
    return NextResponse.json({ keys: data || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.next();
  try {
    const [user, body] = await Promise.all([
      getAuthUser(request, response),
      request.json(),
    ]);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { provider } = body;
    if (!provider) return NextResponse.json({ error: 'Provider required' }, { status: 400 });

    const db = createServiceRoleClient();
    await db.from('api_keys').delete().eq('user_id', user.id).eq('provider', provider);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
