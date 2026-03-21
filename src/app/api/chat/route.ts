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
  MAX_RECENT_MESSAGES,
} from '@/lib/blackboard';

// ============================================
// CHAT API — Blackboard Context Assembly
//
// THE CORE BLACKBOARD PATTERN:
//
// Without Blackboard (message 20):
//   Send: all 20 messages = ~8000 tokens
//
// With Blackboard (message 20):
//   Send: summary (300 tokens) + last 8 msgs (1600 tokens) = ~1900 tokens
//   Savings: ~76% = real money for the user
//
// After this response: check if we need to summarize
// If yes: run summarization INLINE (not fire-and-forget)
// so it ALWAYS completes even on Vercel serverless
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
  } catch (e) { console.error('[Chat] Error saving message:', e); }
}

// ============================================
// INLINE SUMMARIZATION — Runs in same function scope
// This is the KEY FIX: no fire-and-forget fetch
// No risk of Vercel killing the function before it completes
// ============================================
async function runSummarizationInline(conversationId: string, userId: string): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, userId }),
      // No timeout — let it complete fully
    });

    if (response.ok) {
      const result = await response.json();
      if (result.data?.netTokensSaved > 0) {
        console.log(`[Blackboard] ✅ Saved ${result.data.netTokensSaved} tokens (${result.data.percentageSaved}%)`);
      }
    } else {
      console.error('[Blackboard] Summarization failed:', response.status);
    }
  } catch (e) {
    console.error('[Blackboard] Summarization error:', e);
    // Don't throw — summarization failure should not break chat
  }
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

    // Validate conversation
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
    // Build the minimal context that saves tokens
    // ============================================
    let systemContent = systemPrompt || 'You are a helpful, knowledgeable AI assistant.';
    let contextMessages: ChatMessage[] = [];
    let tokensSavedContext = 0;

    if (conversationId) {
      const ctx = await getConversationContext(conversationId, userId);
      tokensSavedContext = ctx.totalTokensSaved;

      if (ctx.summary) {
        // Inject summary into system prompt
        // This replaces ALL old messages — key token saver
        systemContent += `\n\n=== CONVERSATION HISTORY (summarized to save tokens) ===\n${ctx.summary}\n=== END SUMMARY ===\n\nContinue the conversation naturally based on this context.`;
      }

      // Only recent messages (after summary cutoff, max 8)
      contextMessages = ctx.recentMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    }

    // Final message array for AI
    const aiMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...contextMessages,
      { role: 'user', content: message },
    ];

    // Log token estimate
    const estimatedInputTokens = estimateMessagesTokenCount(
      aiMessages.map(m => ({ id: '', role: m.role, content: m.content }))
    );
    console.log(`[Blackboard] 📤 Sending ~${estimatedInputTokens} tokens | ${contextMessages.length}/${MAX_RECENT_MESSAGES} recent msgs | ${tokensSavedContext} tokens saved so far`);

    // Save user message BEFORE streaming
    if (conversationId) {
      await saveMessage(conversationId, userId, 'user', message);
    }

    // Stream using user's API key
    const openaiClient = createOpenAI({ apiKey });
    const result = await streamText({
      model: openaiClient(model),
      messages: aiMessages,
      onFinish: async (completion) => {
        if (!conversationId) return;

        // Save assistant reply with actual token count
        const tokensUsed = completion.usage?.totalTokens || 0;
        await saveMessage(conversationId, userId, 'assistant', completion.text, tokensUsed);

        // Check if we should summarize
        const userCount = await getUserMessageCount(conversationId, userId);
        if (shouldSummarize(userCount)) {
          console.log(`[Blackboard] 🔄 Triggering summarization at ${userCount} user messages`);
          // INLINE — runs in same function, guaranteed to complete
          await runSummarizationInline(conversationId, userId);
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
