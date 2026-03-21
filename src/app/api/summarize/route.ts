import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { serverDecrypt } from '@/lib/encryption';
import OpenAI from 'openai';
import { calculateTokenSavings, type Message } from '@/lib/blackboard';

const MESSAGES_PER_SUMMARY = 10;

async function getUserApiKey(userId: string): Promise<string | null> {
  try {
    const serviceClient = createServiceRoleClient();
    const { data, error } = await serviceClient.from('api_keys').select('*').eq('user_id', userId).eq('provider', 'openai').eq('is_active', true).single();
    if (error || !data) return null;
    return await serverDecrypt({ encryptedKey: data.encrypted_key, iv: data.iv, tag: data.tag, salt: data.salt });
  } catch { return null; }
}

async function getMessagesToSummarize(conversationId: string, userId: string, fromMessageId?: string) {
  try {
    const serviceClient = createServiceRoleClient();
    let query = serviceClient.from('messages').select('id, role, content').eq('conversation_id', conversationId).eq('user_id', userId).order('created_at', { ascending: true });
    if (fromMessageId) {
      const { data: fromMessage } = await serviceClient.from('messages').select('created_at').eq('id', fromMessageId).single();
      if (fromMessage) query = (query as any).gt('created_at', fromMessage.created_at);
    }
    const { data, error } = await query.limit(MESSAGES_PER_SUMMARY);
    if (error) return [];
    return data || [];
  } catch { return []; }
}

async function getExistingSummary(conversationId: string, userId: string) {
  try {
    const serviceClient = createServiceRoleClient();
    const { data, error } = await serviceClient.from('blackboard').select('id, summary, message_count, summary_to_message_id').eq('conversation_id', conversationId).eq('user_id', userId).single();
    if (error) return null;
    return data;
  } catch { return null; }
}

async function generateSummary(messages: Array<{ role: string; content: string }>, existingSummary: string | null, apiKey: string): Promise<string> {
  const openai = new OpenAI({ apiKey });
  const conversationText = messages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n');
  const prompt = existingSummary
    ? `You are maintaining a running summary. Previous summary:\n\n${existingSummary}\n\nNew messages:\n\n${conversationText}\n\nUpdate the summary to include these new messages. Keep it concise (max 500 tokens).`
    : `Summarize this conversation concisely (max 500 tokens). Focus on key topics, decisions, and context:\n\n${conversationText}`;
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: 'You create concise, informative conversation summaries.' }, { role: 'user', content: prompt }],
    max_tokens: 500, temperature: 0.3,
  });
  return response.choices[0]?.message?.content || existingSummary || '';
}

export async function POST(request: NextRequest) {
  try {
    const { conversationId, userId } = await request.json();
    if (!conversationId || !userId) return NextResponse.json({ error: 'conversationId and userId are required' }, { status: 400 });

    const apiKey = await getUserApiKey(userId);
    if (!apiKey) return NextResponse.json({ error: 'No API key found for user' }, { status: 400 });

    const existingSummaryData = await getExistingSummary(conversationId, userId);
    const fromMessageId = existingSummaryData?.summary_to_message_id || null;
    const messagesToSummarize = await getMessagesToSummarize(conversationId, userId, fromMessageId || undefined);

    if (messagesToSummarize.length === 0) return NextResponse.json({ success: true, message: 'No new messages to summarize' });

    const summary = await generateSummary(messagesToSummarize, existingSummaryData?.summary || null, apiKey);
    const messagesForSavings: Message[] = messagesToSummarize.map(msg => ({ id: msg.id, role: msg.role as 'user' | 'assistant' | 'system', content: msg.content }));
    const tokenSavings = calculateTokenSavings(messagesForSavings, summary);
    const totalMessageCount = (existingSummaryData?.message_count || 0) + messagesToSummarize.length;
    const lastMessageId = messagesToSummarize[messagesToSummarize.length - 1]?.id;

    const serviceClient = createServiceRoleClient();
    const { data: existing } = await serviceClient.from('blackboard').select('total_tokens_saved').eq('conversation_id', conversationId).eq('user_id', userId).single();
    const newTotalSavings = (existing?.total_tokens_saved || 0) + tokenSavings.tokensSaved;

    if (existingSummaryData?.id) {
      await serviceClient.from('blackboard').update({ summary, message_count: totalMessageCount, summary_to_message_id: lastMessageId, total_tokens_saved: newTotalSavings, original_tokens: tokenSavings.originalTokens, summarized_tokens: tokenSavings.summarizedTokens, updated_at: new Date().toISOString() }).eq('id', existingSummaryData.id);
    } else {
      await serviceClient.from('blackboard').insert({ conversation_id: conversationId, user_id: userId, summary, message_count: totalMessageCount, summary_to_message_id: lastMessageId, total_tokens_saved: newTotalSavings, original_tokens: tokenSavings.originalTokens, summarized_tokens: tokenSavings.summarizedTokens });
    }

    return NextResponse.json({ success: true, message: 'Summarization completed', data: { messageCount: totalMessageCount, messagesSummarized: messagesToSummarize.length, tokenSavings } });
  } catch (error) {
    return NextResponse.json({ error: 'Summarization failed', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');
    if (!conversationId || !userId) return NextResponse.json({ error: 'conversationId and userId are required' }, { status: 400 });
    const summary = await getExistingSummary(conversationId, userId);
    if (!summary) return NextResponse.json({ error: 'No summary found' }, { status: 404 });
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
