// ============================================
// BLACKBOARD CORE — Optimized for low latency
// Key change: single SQL function replaces 3 sequential queries
// ============================================

import { createServiceRoleClient } from '@/lib/supabase';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationContext {
  summary: string | null;
  summaryToMessageId: string | null;
  recentMessages: Message[];
  totalTokensSaved: number;
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokenCount(messages: Message[]): number {
  return messages.reduce((total, msg) => total + estimateTokenCount(msg.content) + 4, 3);
}

export function shouldSummarize(userMessageCount: number): boolean {
  return userMessageCount > 0 && userMessageCount % 5 === 0;
}

export const MAX_RECENT_MESSAGES = 8;

export function calculateTokenSavings(originalMessages: Message[], summary: string) {
  const originalTokens = estimateMessagesTokenCount(originalMessages);
  const summarizedTokens = estimateTokenCount(summary);
  const tokensSaved = Math.max(0, originalTokens - summarizedTokens);
  return {
    originalTokens,
    summarizedTokens,
    tokensSaved,
    percentageSaved: originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0,
  };
}

// ============================================
// OPTIMIZED CONTEXT BUILDER
// Single SQL function call instead of 3 sequential queries
// 3 round trips → 1 round trip = ~200ms faster
// ============================================
export async function getConversationContext(
  conversationId: string,
  userId: string
): Promise<ConversationContext> {
  const db = createServiceRoleClient();

  // Single RPC call replaces: blackboard query + cutoff query + messages query
  const { data, error } = await db.rpc('get_conversation_context', {
    p_conversation_id: conversationId,
    p_user_id: userId,
    p_max_messages: MAX_RECENT_MESSAGES,
  });

  if (error || !data) {
    // Fallback: return empty context on error
    console.error('[Blackboard] Context fetch error:', error);
    return { summary: null, summaryToMessageId: null, recentMessages: [], totalTokensSaved: 0 };
  }

  // Reverse messages (SQL DESC for LIMIT efficiency, need ASC for AI)
  const recentMessages: Message[] = (data.recentMessages || [])
    .map((m: any) => ({ id: m.id, role: m.role as 'user' | 'assistant' | 'system', content: m.content }))
    .reverse();

  return {
    summary: data.summary || null,
    summaryToMessageId: data.summaryToMessageId || null,
    recentMessages,
    totalTokensSaved: data.totalTokensSaved || 0,
  };
}

// ============================================
// GET UNSUMMARIZED MESSAGES (for summarize route)
// ============================================
export async function getUnsummarizedMessages(
  conversationId: string,
  userId: string
): Promise<{ id: string; role: string; content: string }[]> {
  const db = createServiceRoleClient();

  const { data: blackboard } = await db
    .from('blackboard')
    .select('summary_to_message_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .single();

  const cutoffId = blackboard?.summary_to_message_id;
  let cutoffTime: string | null = null;

  if (cutoffId) {
    const { data: cutoffMsg } = await db
      .from('messages')
      .select('created_at')
      .eq('id', cutoffId)
      .single();
    cutoffTime = cutoffMsg?.created_at || null;
  }

  let query = db
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .neq('role', 'system')
    .order('created_at', { ascending: true });

  if (cutoffTime) {
    query = query.gt('created_at', cutoffTime) as any;
  }

  const { data } = await query;
  return data || [];
}

export async function getUserMessageCount(conversationId: string, userId: string): Promise<number> {
  const db = createServiceRoleClient();
  const { count, error } = await db
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('role', 'user');
  if (error) return 0;
  return count || 0;
}

export async function getTotalTokenSavingsForUser(userId: string): Promise<number> {
  const db = createServiceRoleClient();
  const { data } = await db
    .from('blackboard')
    .select('total_tokens_saved')
    .eq('user_id', userId);
  return (data || []).reduce((sum, row) => sum + (row.total_tokens_saved || 0), 0);
}
