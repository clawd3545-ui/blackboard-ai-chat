import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase';
import { serverDecrypt } from '@/lib/encryption';
import { streamText } from 'ai';
import {
  shouldSummarize, getUserMessageCount,
  getConversationContext, estimateMessagesTokenCount, MAX_RECENT_MESSAGES,
} from '@/lib/blackboard';
import { createModel, type ProviderId, PROVIDERS } from '@/lib/providers';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

// Fast local JWT validation — no HTTP round trip to Supabase
async function getSession(request: NextRequest, response: NextResponse) {
  const supabase = createRouteHandlerClient(request, response);
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

async function getUserApiKey(userId: string, provider: string): Promise<string | null> {
  try {
    const db = createServiceRoleClient();
    const { data, error } = await db.from('api_keys').select('*')
      .eq('user_id', userId).eq('provider', provider).eq('is_active', true).single();
    if (error || !data) return null;
    return await serverDecrypt({ encryptedKey: data.encrypted_key, iv: data.iv, tag: data.tag, salt: data.salt });
  } catch { return null; }
}

// Non-blocking fire-and-forget saves
function saveAsync(conversationId: string, userId: string, role: string, content: string, tokens = 0) {
  Promise.resolve(
    createServiceRoleClient().from('messages')
      .insert({ conversation_id: conversationId, user_id: userId, role, content, tokens_used: tokens })
  ).then(({ error }) => { if (error) console.error('[save]', error?.message); })
   .catch(e => console.error('[save]', e));
}

function summarizeAsync(conversationId: string, userId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  fetch(`${base}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, userId }),
  }).then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.data?.netTokensSaved > 0) console.log(`[Blackboard] ✅ ${d.data.netTokensSaved} tokens saved`); })
    .catch(e => console.error('[summarize]', e));
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next();

  try {
    // ── Parallel: parse body + validate session ────────────────────────
    const [bodyData, session] = await Promise.all([
      request.json(),
      getSession(request, response),
    ]);

    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, conversationId, model = 'gpt-4o-mini', provider = 'openai', systemPrompt } = bodyData;
    if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const userId = session.user.id;
    const db = createServiceRoleClient();

    // ── Parallel: fetch API key + conversation context ─────────────────
    const parallelTasks: Promise<any>[] = [getUserApiKey(userId, provider)];
    if (conversationId) {
      parallelTasks.push(
        Promise.resolve(db.from('conversations').select('id').eq('id', conversationId).eq('user_id', userId).single()),
        getConversationContext(conversationId, userId),
      );
    }

    const [apiKey, convResult, ctx] = await Promise.all(parallelTasks);

    if (!apiKey) {
      const name = PROVIDERS.find(p => p.id === provider)?.name || provider;
      return NextResponse.json({ error: 'No API key', message: `Add your ${name} API key in Settings.` }, { status: 400 });
    }

    if (conversationId) {
      if (convResult?.error || !convResult?.data) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      // Update metadata — fire and forget, don't await
      Promise.resolve(db.from('conversations').update({ provider, last_model: model, updated_at: new Date().toISOString() }).eq('id', conversationId)).then(() => {}).catch(() => {});
    }

    // ── Build AI messages ──────────────────────────────────────────────
    let systemContent = systemPrompt || 'You are a helpful, knowledgeable AI assistant.';
    if (ctx?.summary) {
      systemContent += `\n\n=== CONVERSATION HISTORY (summarized) ===\n${ctx.summary}\n=== END SUMMARY ===\n\nContinue naturally.`;
    }

    const contextMessages: ChatMessage[] = (ctx?.recentMessages || []).map((m: any) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const aiMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...contextMessages,
      { role: 'user', content: message.trim() },
    ];

    console.log(`[Chat] 📤 ${provider}/${model} | ~${estimateMessagesTokenCount(aiMessages.map(m => ({ id: '', role: m.role, content: m.content })))} tokens | ${contextMessages.length}/${MAX_RECENT_MESSAGES} msgs`);

    // ── Save user message async (doesn't block streaming) ─────────────
    if (conversationId) saveAsync(conversationId, userId, 'user', message.trim());

    // ── Stream ─────────────────────────────────────────────────────────
    const result = await streamText({
      model: createModel(provider as ProviderId, apiKey, model),
      messages: aiMessages,
      onFinish: async (completion) => {
        if (!conversationId) return;
        saveAsync(conversationId, userId, 'assistant', completion.text, completion.usage?.totalTokens || 0);
        const userCount = await getUserMessageCount(conversationId, userId);
        if (shouldSummarize(userCount)) {
          console.log(`[Blackboard] 🔄 Trigger at ${userCount} msgs`);
          summarizeAsync(conversationId, userId);
        }
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
    const session = await getSession(request, response);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const convId = new URL(request.url).searchParams.get('conversationId');
    if (!convId) return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    const { data, error } = await createServiceRoleClient()
      .from('messages').select('*')
      .eq('conversation_id', convId).eq('user_id', session.user.id)
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    return NextResponse.json({ messages: data || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
