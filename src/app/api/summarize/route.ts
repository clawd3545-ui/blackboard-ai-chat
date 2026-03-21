import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { serverDecrypt } from '@/lib/encryption';
import OpenAI from 'openai';
import { calculateTokenSavings, type Message, getUnsummarizedMessages } from '@/lib/blackboard';

// ============================================
// SUMMARIZE API — The heart of Blackboard USP
//
// HOW IT WORKS:
// 1. Get all messages NOT yet summarized (after cutoff)
// 2. Summarize them using user's own OpenAI key
// 3. Update blackboard: new summary + new cutoff point
// 4. Track exact tokens saved
//
// RESULT: Old 5000-word chat → 400-word summary
// Next message only sends: summary + new messages
// Token savings: 60-90%
// ============================================

async function getUserApiKey(userId: string): Promise<string | null> {
  try {
    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'openai')
      .eq('is_active', true)
      .single();
    if (error || !data) return null;
    return await serverDecrypt({
      encryptedKey: data.encrypted_key,
      iv: data.iv,
      tag: data.tag,
      salt: data.salt,
    });
  } catch { return null; }
}

async function getExistingBlackboard(conversationId: string, userId: string) {
  try {
    const db = createServiceRoleClient();
    const { data } = await db
      .from('blackboard')
      .select('id, summary, message_count, total_tokens_saved, summary_to_message_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();
    return data;
  } catch { return null; }
}

async function generateRollingSummary(
  newMessages: Array<{ role: string; content: string }>,
  existingSummary: string | null,
  apiKey: string
): Promise<{ summary: string; tokensUsed: number }> {
  const openai = new OpenAI({ apiKey });

  // Build the conversation text from new messages
  const conversationText = newMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  let prompt: string;
  if (existingSummary) {
    // Rolling update: incorporate new messages into existing summary
    prompt = `You are maintaining a running conversation summary for an AI assistant's context window.

EXISTING SUMMARY (what happened before):
${existingSummary}

NEW MESSAGES TO INCORPORATE:
${conversationText}

Update the summary to include the new messages. The summary must:
- Be under 400 words
- Capture all important facts, questions, decisions, and context
- Write in third person (e.g., "The user asked about X, the assistant explained Y")
- Be dense with information — every sentence should matter
- Preserve specific details like names, numbers, code snippets, or decisions

Return ONLY the updated summary, nothing else.`;
  } else {
    // First summary: summarize all messages from scratch
    prompt = `Summarize this conversation for an AI assistant's context window.

CONVERSATION:
${conversationText}

Requirements:
- Under 400 words
- Capture all important facts, questions, decisions, and context
- Write in third person (e.g., "The user asked about X, the assistant explained Y")
- Be dense with information
- Preserve specific details like names, numbers, code snippets, or decisions

Return ONLY the summary, nothing else.`;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You create dense, information-rich conversation summaries. Every word must earn its place.'
      },
      { role: 'user', content: prompt }
    ],
    max_tokens: 600,
    temperature: 0.2, // Low temp for consistent, factual summaries
  });

  const summary = response.choices[0]?.message?.content?.trim() || existingSummary || '';
  const tokensUsed = response.usage?.total_tokens || 0;

  return { summary, tokensUsed };
}

export async function POST(request: NextRequest) {
  try {
    const { conversationId, userId } = await request.json();
    if (!conversationId || !userId) {
      return NextResponse.json({ error: 'conversationId and userId are required' }, { status: 400 });
    }

    // Get user's API key (BYOK — user pays, we don't)
    const apiKey = await getUserApiKey(userId);
    if (!apiKey) {
      return NextResponse.json({ error: 'No API key found' }, { status: 400 });
    }

    // Get ALL unsummarized messages (messages after current cutoff)
    const unsummarizedMessages = await getUnsummarizedMessages(conversationId, userId);
    if (unsummarizedMessages.length < 2) {
      // Not enough new messages to summarize
      return NextResponse.json({ success: true, message: 'Nothing new to summarize', tokensSaved: 0 });
    }

    // Get existing blackboard state
    const existingBlackboard = await getExistingBlackboard(conversationId, userId);
    const existingSummary = existingBlackboard?.summary || null;

    // Generate rolling summary
    const { summary, tokensUsed: summarizationCost } = await generateRollingSummary(
      unsummarizedMessages,
      existingSummary,
      apiKey
    );

    // Calculate how many tokens we saved
    const messagesForSavingsCalc: Message[] = unsummarizedMessages.map(m => ({
      id: 'temp',
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));
    const savings = calculateTokenSavings(messagesForSavingsCalc, summary);

    // Net savings = what we saved minus what it cost to summarize
    const netTokensSaved = Math.max(0, savings.tokensSaved - summarizationCost);

    // The last message ID becomes our new cutoff point
    const lastMessageId = unsummarizedMessages[unsummarizedMessages.length - 1].id;
    const firstMessageId = unsummarizedMessages[0].id;
    const newMessageCount = (existingBlackboard?.message_count || 0) + unsummarizedMessages.length;
    const newTotalSaved = (existingBlackboard?.total_tokens_saved || 0) + netTokensSaved;

    // Save to blackboard
    const db = createServiceRoleClient();
    if (existingBlackboard?.id) {
      await db.from('blackboard').update({
        summary,
        summary_to_message_id: lastMessageId,
        message_count: newMessageCount,
        total_tokens_saved: newTotalSaved,
        original_tokens: savings.originalTokens,
        summarized_tokens: savings.summarizedTokens,
        updated_at: new Date().toISOString(),
      }).eq('id', existingBlackboard.id);
    } else {
      await db.from('blackboard').insert({
        conversation_id: conversationId,
        user_id: userId,
        summary,
        summary_from_message_id: firstMessageId,
        summary_to_message_id: lastMessageId,
        message_count: newMessageCount,
        total_tokens_saved: newTotalSaved,
        original_tokens: savings.originalTokens,
        summarized_tokens: savings.summarizedTokens,
      });
    }

    console.log(`[Blackboard] Summarized ${unsummarizedMessages.length} messages. Net saved: ${netTokensSaved} tokens (${savings.percentageSaved}%)`);

    return NextResponse.json({
      success: true,
      data: {
        messagesSummarized: unsummarizedMessages.length,
        originalTokens: savings.originalTokens,
        summarizedTokens: savings.summarizedTokens,
        summarizationCost,
        netTokensSaved,
        percentageSaved: savings.percentageSaved,
        totalTokensSaved: newTotalSaved,
      }
    });
  } catch (error) {
    console.error('[Blackboard] Summarization error:', error);
    return NextResponse.json({
      error: 'Summarization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');
    if (!conversationId || !userId) {
      return NextResponse.json({ error: 'conversationId and userId required' }, { status: 400 });
    }
    const db = createServiceRoleClient();
    const { data } = await db
      .from('blackboard')
      .select('summary, message_count, total_tokens_saved, original_tokens, summarized_tokens')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get summary' }, { status: 500 });
  }
}
