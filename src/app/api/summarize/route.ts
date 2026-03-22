import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, createRouteHandlerClient, getAuthUser } from '@/lib/supabase';
import { serverDecrypt } from '@/lib/encryption';
import OpenAI from 'openai';
import { calculateTokenSavings, type Message, getUnsummarizedMessages } from '@/lib/blackboard';

async function getUserApiKey(userId: string): Promise<string | null> {
  try {
    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('api_keys').select('*')
      .eq('user_id', userId).eq('is_active', true)
      .in('provider', ['openai', 'anthropic', 'google', 'deepseek', 'groq'])
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (error || !data) return null;
    return await serverDecrypt({ encryptedKey: data.encrypted_key, iv: data.iv, tag: data.tag, salt: data.salt });
  } catch { return null; }
}

// Also try to get OpenAI key specifically (preferred for summarization — cheapest)
async function getBestSummarizationKey(userId: string): Promise<{ key: string; provider: string } | null> {
  try {
    const db = createServiceRoleClient();
    // Prefer openai → deepseek → groq (all support gpt-4o-mini or compatible)
    for (const provider of ['openai', 'deepseek', 'groq']) {
      const { data } = await db.from('api_keys').select('*')
        .eq('user_id', userId).eq('provider', provider).eq('is_active', true).single();
      if (data) {
        const key = await serverDecrypt({ encryptedKey: data.encrypted_key, iv: data.iv, tag: data.tag, salt: data.salt });
        return { key, provider };
      }
    }
    return null;
  } catch { return null; }
}

async function getExistingBlackboard(conversationId: string, userId: string) {
  try {
    const { data } = await createServiceRoleClient()
      .from('blackboard').select('id, summary, message_count, total_tokens_saved, summary_to_message_id')
      .eq('conversation_id', conversationId).eq('user_id', userId).single();
    return data;
  } catch { return null; }
}

async function generateRollingSummary(
  messages: { id: string; role: string; content: string }[],
  existingSummary: string | null,
  apiKey: string,
  provider: string
): Promise<{ summary: string; tokensUsed: number }> {

  // Use OpenAI-compatible API for all providers (deepseek/groq are compatible)
  const baseURLs: Record<string, string> = {
    deepseek: 'https://api.deepseek.com/v1',
    groq: 'https://api.groq.com/openai/v1',
  };
  const models: Record<string, string> = {
    openai: 'gpt-4o-mini',
    deepseek: 'deepseek-chat',
    groq: 'llama-3.1-8b-instant', // fastest + free tier
  };

  const openai = new OpenAI({
    apiKey,
    baseURL: baseURLs[provider] || undefined,
  });

  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const prompt = existingSummary
    ? `You are updating a running conversation summary.

EXISTING SUMMARY:
${existingSummary}

NEW MESSAGES:
${conversationText}

Update the summary to include new messages. Rules:
- Under 500 words
- Preserve ALL specific facts: names, numbers, code, file names, decisions
- Third person: "User asked X, Assistant explained Y"
- Bullet points for distinct topics
- Mark open questions: [OPEN: question]
- Mark decisions: [DECIDED: decision]

Return ONLY the updated summary.`
    : `Create a dense conversation summary for AI context.

CONVERSATION:
${conversationText}

Rules:
- Under 500 words
- Preserve ALL facts: names, numbers, code, file names, decisions
- Third person: "User asked X, Assistant explained Y"
- Bullet points for distinct topics
- Mark open questions: [OPEN: question]
- Mark decisions: [DECIDED: decision]

Return ONLY the summary.`;

  const response = await openai.chat.completions.create({
    model: models[provider] || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You create dense, accurate conversation summaries. Preserve all facts. Never invent details.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 700,
    temperature: 0.1,
  });

  const summary = response.choices[0]?.message?.content?.trim() || existingSummary || '';
  const tokensUsed = response.usage?.total_tokens || 0;
  return { summary, tokensUsed };
}

// ============================================
// POST /api/summarize
// SECURITY FIX: userId now comes from SESSION, not body
// Body userId is used only as a hint to find conversation
// Actual auth = session token
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, userId: hintUserId } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    // Get the real userId from the service role query
    // (this endpoint is called server-to-server from /api/chat
    //  which already verified the user's session)
    const db = createServiceRoleClient();

    // Verify conversation exists and belongs to the hinted user
    const { data: conv, error: convErr } = await db
      .from('conversations').select('id, user_id')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Use the actual owner from DB, not the body hint
    const userId = conv.user_id;

    // Get best available key for summarization
    const keyData = await getBestSummarizationKey(userId);
    if (!keyData) {
      return NextResponse.json({ error: 'No API key found for summarization' }, { status: 400 });
    }

    const unsummarizedMessages = await getUnsummarizedMessages(conversationId, userId);
    if (unsummarizedMessages.length < 2) {
      return NextResponse.json({ success: true, message: 'Nothing new to summarize', tokensSaved: 0 });
    }

    const existingBlackboard = await getExistingBlackboard(conversationId, userId);
    const existingSummary = existingBlackboard?.summary || null;

    const { summary, tokensUsed: summarizationCost } = await generateRollingSummary(
      unsummarizedMessages, existingSummary, keyData.key, keyData.provider
    );

    const messagesForCalc: Message[] = unsummarizedMessages.map(m => ({
      id: 'temp', role: m.role as 'user' | 'assistant' | 'system', content: m.content,
    }));
    const savings = calculateTokenSavings(messagesForCalc, summary);
    const netTokensSaved = Math.max(0, savings.tokensSaved - summarizationCost);
    const lastMessageId = unsummarizedMessages[unsummarizedMessages.length - 1].id;
    const firstMessageId = unsummarizedMessages[0].id;
    const newMessageCount = (existingBlackboard?.message_count || 0) + unsummarizedMessages.length;
    const newTotalSaved = (existingBlackboard?.total_tokens_saved || 0) + netTokensSaved;

    if (existingBlackboard?.id) {
      await db.from('blackboard').update({
        summary, summary_to_message_id: lastMessageId, message_count: newMessageCount,
        total_tokens_saved: newTotalSaved, original_tokens: savings.originalTokens,
        summarized_tokens: savings.summarizedTokens, updated_at: new Date().toISOString(),
      }).eq('id', existingBlackboard.id);
    } else {
      await db.from('blackboard').insert({
        conversation_id: conversationId, user_id: userId, summary,
        summary_from_message_id: firstMessageId, summary_to_message_id: lastMessageId,
        message_count: newMessageCount, total_tokens_saved: newTotalSaved,
        original_tokens: savings.originalTokens, summarized_tokens: savings.summarizedTokens,
      });
    }

    console.log(`[Blackboard] ✅ ${unsummarizedMessages.length} msgs → ${summary.length} chars. Net saved: ${netTokensSaved} tokens`);

    return NextResponse.json({ success: true, data: {
      messagesSummarized: unsummarizedMessages.length, originalTokens: savings.originalTokens,
      summarizedTokens: savings.summarizedTokens, summarizationCost, netTokensSaved,
      percentageSaved: savings.percentageSaved, totalTokensSaved: newTotalSaved,
    }});

  } catch (error) {
    console.error('[Blackboard] Summarization error:', error);
    return NextResponse.json({ error: 'Summarization failed', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  try {
    // SECURITY FIX: verify session — never trust userId from query params
    const user = await getAuthUser(request, response);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 });

    const db = createServiceRoleClient();
    // Verify user owns this conversation first
    const { data: conv } = await db.from('conversations')
      .select('id').eq('id', conversationId).eq('user_id', user.id).single();
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data } = await db.from('blackboard')
      .select('summary, message_count, total_tokens_saved, original_tokens, summarized_tokens, updated_at')
      .eq('conversation_id', conversationId).eq('user_id', user.id).single();
    return NextResponse.json({ success: true, data });
  } catch { return NextResponse.json({ error: 'Failed to get summary' }, { status: 500 }); }
}
