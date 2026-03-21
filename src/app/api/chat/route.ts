import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase';
import { serverDecrypt } from '@/lib/encryption';
import { streamText } from 'ai';
import {
  shouldSummarize,
  getUserMessageCount,
  getConversationContext,
  estimateMessagesTokenCount,
  MAX_RECENT_MESSAGES,
} from '@/lib/blackboard';
import { createModel, type ProviderId, PROVIDERS } from '@/lib/providers';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

async function getUserApiKey(userId: string, provider: string): Promise<string | null> {
  try {
    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('api_keys').select('*')
      .eq('user_id', userId).eq('provider', provider).eq('is_active', true)
      .single();
    if (error || !data) return null;
    return await serverDecrypt({ encryptedKey: data.encrypted_key, iv: data.iv, tag: data.tag, salt: data.salt });
  } catch { return null; }
}

async function saveMessage(conversationId: string, userId: string, role: string, content: string, tokensUsed = 0) {
  try {
    await createServiceRoleClient()
      .from('messages')
      .insert({ conversation_id: conversationId, user_id: userId, role, content, tokens_used: tokensUsed });
  } catch (e) { console.error('[Chat] Error saving message:', e); }
}

async function runSummarizationInline(conversationId: string, userId: string): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, userId }),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.data?.netTokensSaved > 0)
        console.log(`[Blackboard] ✅ Saved ${result.data.netTokensSaved} tokens (${result.data.percentageSaved}%)`);
    }
  } catch (e) { console.error('[Blackboard] Summarization error:', e); }
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const { message, conversationId, model = 'gpt-4o-mini', provider = 'openai', systemPrompt } = await request.json();
    if (!message || typeof message !== 'string') return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    // Get API key for the chosen provider
    const apiKey = await getUserApiKey(userId, provider);
    if (!apiKey) {
      const providerName = PROVIDERS.find(p => p.id === provider)?.name || provider;
      return NextResponse.json({
        error: 'No API key found',
        message: `Please add your ${providerName} API key in Settings to use this model.`
      }, { status: 400 });
    }

    // Validate conversation belongs to user
    if (conversationId) {
      const { data: conv, error: convErr } = await createServiceRoleClient()
        .from('conversations').select('id')
        .eq('id', conversationId).eq('user_id', userId).single();
      if (convErr || !conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

      // Update conversation's last used provider + model
      await createServiceRoleClient()
        .from('conversations')
        .update({ provider, last_model: model, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    // BLACKBOARD CONTEXT ASSEMBLY
    let systemContent = systemPrompt || 'You are a helpful, knowledgeable AI assistant.';
    let contextMessages: ChatMessage[] = [];

    if (conversationId) {
      const ctx = await getConversationContext(conversationId, userId);
      if (ctx.summary) {
        systemContent += `\n\n=== CONVERSATION HISTORY (summarized to save tokens) ===\n${ctx.summary}\n=== END SUMMARY ===\n\nContinue the conversation naturally based on this context.`;
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

    const estimatedTokens = estimateMessagesTokenCount(
      aiMessages.map(m => ({ id: '', role: m.role, content: m.content }))
    );
    console.log(`[Chat] 📤 ${provider}/${model} | ~${estimatedTokens} tokens | ${contextMessages.length}/${MAX_RECENT_MESSAGES} recent msgs`);

    if (conversationId) await saveMessage(conversationId, userId, 'user', message);

    // Create model using provider routing
    const aiModel = createModel(provider as ProviderId, apiKey, model);

    const result = await streamText({
      model: aiModel,
      messages: aiMessages,
      onFinish: async (completion) => {
        if (!conversationId) return;
        const tokensUsed = completion.usage?.totalTokens || 0;
        await saveMessage(conversationId, userId, 'assistant', completion.text, tokensUsed);
        const userCount = await getUserMessageCount(conversationId, userId);
        if (shouldSummarize(userCount)) {
          console.log(`[Blackboard] 🔄 Summarizing at ${userCount} user msgs`);
          await runSummarizationInline(conversationId, userId);
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
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    if (!conversationId) return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    const { data: messages, error } = await createServiceRoleClient()
      .from('messages').select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    return NextResponse.json({ messages: messages || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
