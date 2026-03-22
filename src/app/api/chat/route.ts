import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createServiceRoleClient } from '@/lib/supabase';
import { serverDecrypt } from '@/lib/encryption';
import { streamText } from 'ai';
import {
  shouldSummarize, getUserMessageCount,
  getConversationContext, estimateMessagesTokenCount, MAX_RECENT_MESSAGES,
} from '@/lib/blackboard';
import { createModel, type ProviderId, PROVIDERS } from '@/lib/providers';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

async function getUserApiKey(userId: string, provider: string): Promise<string | null> {
  try {
    const db = createServiceRoleClient();
    const { data } = await db
      .from('api_keys')
      .select('encrypted_key, iv, tag, salt')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();
    if (!data) return null;
    // Map DB snake_case to interface camelCase
    return await serverDecrypt({
      encryptedKey: data.encrypted_key,
      iv: data.iv,
      tag: data.tag,
      salt: data.salt,
    });
  } catch { return null; }
}

// Fire-and-forget helpers — never block the stream
function saveMessageAsync(conversationId: string, userId: string, role: string, content: string, tokensUsed = 0) {
  void createServiceRoleClient()
    .from('messages')
    .insert({ conversation_id: conversationId, user_id: userId, role, content, tokens_used: tokensUsed });
}

function updateConversationAsync(conversationId: string, provider: string, model: string) {
  void createServiceRoleClient()
    .from('conversations')
    .update({ provider, last_model: model, updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

function runSummarizationAsync(conversationId: string, userId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  void fetch(`${baseUrl}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, userId }),
  }).then(async r => {
    if (!r.ok) return;
    const d = await r.json().catch(() => null);
    if (d?.data?.netTokensSaved > 0)
      console.log(`[Blackboard] ✅ Saved ${d.data.netTokensSaved} tokens`);
  }).catch(e => console.error('[Blackboard] Error:', e));
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  try {
    // Parse auth + body in parallel
    const [user, body] = await Promise.all([
      getAuthUser(request, response),
      request.json(),
    ]);

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, conversationId, model = 'gpt-4o-mini', provider = 'openai', systemPrompt } = body;
    if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    const userId = user.id;

    // Fetch API key + conversation context in parallel — biggest speedup
    const [apiKey, ctx, convCheck] = await Promise.all([
      getUserApiKey(userId, provider),
      conversationId ? getConversationContext(conversationId, userId) : Promise.resolve(null),
      conversationId
        ? createServiceRoleClient().from('conversations').select('id').eq('id', conversationId).eq('user_id', userId).maybeSingle()
        : Promise.resolve({ data: true, error: null }),
    ]);

    if (!apiKey) {
      const providerName = PROVIDERS.find(p => p.id === provider)?.name || provider;
      return NextResponse.json({
        error: 'No API key found',
        message: `Please add your ${providerName} API key in Settings.`
      }, { status: 400 });
    }

    if (conversationId && !convCheck.data) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Non-critical update — fire-and-forget
    if (conversationId) updateConversationAsync(conversationId, provider, model);

    // Build context
    let systemContent = systemPrompt || 'You are a helpful, knowledgeable AI assistant.';
    let contextMessages: ChatMessage[] = [];

    if (ctx) {
      if (ctx.summary) {
        systemContent += `\n\n=== CONVERSATION HISTORY (summarized) ===\n${ctx.summary}\n=== END SUMMARY ===\n\nContinue naturally.`;
      }
      contextMessages = ctx.recentMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    }

    const aiMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...contextMessages,
      { role: 'user', content: message },
    ];

    const est = estimateMessagesTokenCount(aiMessages.map(m => ({ id: '', role: m.role, content: m.content })));
    console.log(`[Chat] 📤 ${provider}/${model} | ~${est} tokens | ${contextMessages.length}/${MAX_RECENT_MESSAGES} msgs`);

    // Save user message async — doesn't delay stream start
    if (conversationId) saveMessageAsync(conversationId, userId, 'user', message);

    // START STREAM immediately
    const aiModel = createModel(provider as ProviderId, apiKey, model);
    const result = await streamText({
      model: aiModel,
      messages: aiMessages,
      onFinish: async (completion) => {
        if (!conversationId) return;
        saveMessageAsync(conversationId, userId, 'assistant', completion.text, completion.usage?.totalTokens || 0);
        try {
          const userCount = await getUserMessageCount(conversationId, userId);
          if (shouldSummarize(userCount)) {
            console.log(`[Blackboard] 🔄 Summarizing at ${userCount} msgs`);
            runSummarizationAsync(conversationId, userId);
          }
        } catch {}
      },
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[Chat] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  try {
    const user = await getAuthUser(request, response);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    if (!conversationId) return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    const { data: messages, error } = await createServiceRoleClient()
      .from('messages').select('*')
      .eq('conversation_id', conversationId).eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    return NextResponse.json({ messages: messages || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Vercel Edge Runtime — no cold starts, runs at edge globally
// This alone can cut 200-400ms from first request
export const runtime = 'edge';
