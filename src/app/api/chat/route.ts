import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase';
import { serverDecrypt } from '@/lib/encryption';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import {
  shouldSummarize,
  getUserMessageCount,
  getConversationContext,
  estimateMessagesTokenCount,
} from '@/lib/blackboard';

// ============================================
// CHAT API — Blackboard Context Assembly
//
// THE CORE BLACKBOARD PATTERN:
// Instead of sending all 5000 words of chat history,
// we send: [system + summary] + [only recent messages]
//
// Example with 30 messages:
// - Messages 1-20: summarized into ~300 words ✓
// - Messages 21-30: sent as-is (recent context) ✓
// - Total tokens sent: ~500 instead of ~8000
// - Savings: ~94%
// ============================================

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

async function getUserApiKey(userId: string): Promise<string | null> {
  try {
    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('api_keys').select('*')
      .eq('user_id', userId).eq('provider', 'openai').eq('is_active', true)
      .single();
    if (error || !data) return null;
    return await serverDecrypt({ encryptedKey: data.encrypted_key, iv: data.iv, tag: data.tag, salt: data.salt });
  } catch { return null; }
}

async function saveMessage(
  conversationId: string,
  userId: string,
  role: string,
  content: string,
  tokensUsed = 0
) {
  try {
    await createServiceRoleClient()
      .from('messages')
      .insert({ conversation_id: conversationId, user_id: userId, role, content, tokens_used: tokensUsed });
  } catch (e) { console.error('Error saving message:', e); }
}

async function triggerSummarization(conversationId: string, userId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    // Fire and forget — don't block the chat response
    fetch(`${baseUrl}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, userId }),
    }).catch(e => console.error('[Blackboard] Summarization trigger failed:', e));
  } catch (e) { console.error('[Blackboard] Could not trigger summarization:', e); }
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { message, conversationId, model = 'gpt-4o-mini', systemPrompt } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get user's API key
    const apiKey = await getUserApiKey(userId);
    if (!apiKey) {
      return NextResponse.json({
        error: 'No API key found',
        message: 'Please add your OpenAI API key in Settings to start chatting.'
      }, { status: 400 });
    }

    // Validate conversation belongs to user
    if (conversationId) {
      const { data: conv, error: convErr } = await createServiceRoleClient()
        .from('conversations').select('id')
        .eq('id', conversationId).eq('user_id', userId)
        .single();
      if (convErr || !conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    // ============================================
    // BLACKBOARD CONTEXT ASSEMBLY
    // This is the magic — build minimal context
    // ============================================
    let systemContent = systemPrompt || 'You are a helpful, knowledgeable AI assistant.';
    let contextMessages: ChatMessage[] = [];

    if (conversationId) {
      const ctx = await getConversationContext(conversationId, userId);

      if (ctx.summary) {
        // Inject summary as part of system prompt
        // This replaces the old messages entirely
        systemContent += `

--- CONVERSATION HISTORY (summarized) ---
${ctx.summary}
--- END OF SUMMARY ---

The above is a summary of the conversation so far. Continue naturally from where we left off.`;
      }

      // Only include RECENT messages (after the summary cutoff)
      // NOT the full history — that's what saves tokens!
      contextMessages = ctx.recentMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));
    }

    // Build final message array for the AI
    const aiMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...contextMessages,          // Only recent messages (post-summary)
      { role: 'user', content: message }, // New message
    ];

    // Log token estimate for debugging
    const estimatedTokens = estimateMessagesTokenCount(
      aiMessages.map(m => ({ id: '', role: m.role, content: m.content }))
    );
    console.log(`[Blackboard] Sending ~${estimatedTokens} tokens (${contextMessages.length} recent messages + summary)`);

    // Save user message
    if (conversationId) {
      await saveMessage(conversationId, userId, 'user', message);
    }

    // Stream response using user's API key
    const openaiClient = createOpenAI({ apiKey });
    const result = await streamText({
      model: openaiClient(model),
      messages: aiMessages,
      onFinish: async (completion) => {
        if (!conversationId) return;

        // Save assistant reply
        await saveMessage(
          conversationId, userId,
          'assistant', completion.text,
          completion.usage?.totalTokens || 0
        );

        // Check if we need to summarize (every 5 user messages)
        const userCount = await getUserMessageCount(conversationId, userId);
        if (shouldSummarize(userCount)) {
          console.log(`[Blackboard] Triggering summarization at ${userCount} user messages`);
          triggerSummarization(conversationId, userId);
        }
      },
    });

    return result.toAIStreamResponse();

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
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }
    const { data: messages, error } = await createServiceRoleClient()
      .from('messages').select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
