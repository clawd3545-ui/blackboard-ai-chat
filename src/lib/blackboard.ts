// ============================================
// BLACKBOARD CORE — Production-grade token-saving memory
// Pattern: ConversationSummaryBuffer (proven by LangChain, Claude Code)
// Summary + last N messages = 60-90% token savings
// ============================================

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

// ============================================
// TOKEN ESTIMATION
// Accurate: ~1 token per 4 chars for English
// Add 4 tokens per message for role/format overhead
// ============================================
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokenCount(messages: Message[]): number {
  return messages.reduce((total, msg) => {
    return total + estimateTokenCount(msg.content) + 4;
  }, 3); // base overhead
}

// ============================================
// SUMMARIZATION TRIGGER
// Fire every 5 USER messages (total count)
// This works: 5→trigger, 6-9→skip, 10→trigger, etc.
// ============================================
export function shouldSummarize(userMessageCount: number): boolean {
  return userMessageCount > 0 && userMessageCount % 5 === 0;
}

// ============================================
// HARD CAP ON RECENT MESSAGES
// Even without summary, never send more than MAX_RECENT
// This is the safety net — prevents context bloat
// ============================================
export const MAX_RECENT_MESSAGES = 8; // ~2000 tokens max for recent context

// ============================================
// TOKEN SAVINGS CALCULATOR
// ============================================
export function calculateTokenSavings(
  originalMessages: Message[],
  summary: string
): {
  originalTokens: number;
  summarizedTokens: number;
  tokensSaved: number;
  percentageSaved: number;
} {
  const originalTokens = estimateMessagesTokenCount(originalMessages);
  const summarizedTokens = estimateTokenCount(summary);
  const tokensSaved = Math.max(0, originalTokens - summarizedTokens);
  const percentageSaved = originalTokens > 0
    ? Math.round((tokensSaved / originalTokens) * 100)
    : 0;

  return { originalTokens, summarizedTokens, tokensSaved, percentageSaved };
}

// ============================================
// CONVERSATION CONTEXT BUILDER — THE CORE
//
// What we send to AI:
// [system + summary_of_old_msgs] + [last 8 recent_msgs] + [new_msg]
//
// What we DON'T send:
// All the old messages — those are replaced by the summary
//
// Example:
// 30 messages (8000 tokens) → summary (300 tokens) + last 8 msgs (800 tokens)
// Sent tokens: 1100 instead of 8000 = 86% savings
// ============================================
export async function getConversationContext(
  conversationId: string,
  userId: string
): Promise<ConversationContext> {
  const { createServiceRoleClient } = await import('@/lib/supabase');
  const db = createServiceRoleClient();

  // Get blackboard entry
  const { data: blackboard } = await db
    .from('blackboard')
    .select('summary, summary_to_message_id, total_tokens_saved')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .single();

  const summaryToMessageId = blackboard?.summary_to_message_id || null;

  // Get ONLY messages AFTER the summary cutoff
  let messagesQuery = db
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .neq('role', 'system') // exclude system messages
    .order('created_at', { ascending: true });

  if (summaryToMessageId) {
    const { data: cutoffMsg } = await db
      .from('messages')
      .select('created_at')
      .eq('id', summaryToMessageId)
      .single();

    if (cutoffMsg) {
      messagesQuery = messagesQuery.gt('created_at', cutoffMsg.created_at) as any;
    }
  }

  const { data: messagesData } = await messagesQuery;
  let recentMessages: Message[] = (messagesData || []).map((m: any) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  // HARD CAP: never send more than MAX_RECENT_MESSAGES
  // Even if summarization hasn't run yet, we cap the context
  if (recentMessages.length > MAX_RECENT_MESSAGES) {
    recentMessages = recentMessages.slice(-MAX_RECENT_MESSAGES);
  }

  return {
    summary: blackboard?.summary || null,
    summaryToMessageId,
    recentMessages,
    totalTokensSaved: blackboard?.total_tokens_saved || 0,
  };
}

// ============================================
// GET MESSAGES TO SUMMARIZE
// Returns all unsummarized messages (after cutoff)
// ============================================
export async function getUnsummarizedMessages(
  conversationId: string,
  userId: string
): Promise<{ id: string; role: string; content: string }[]> {
  const { createServiceRoleClient } = await import('@/lib/supabase');
  const db = createServiceRoleClient();

  const { data: blackboard } = await db
    .from('blackboard')
    .select('summary_to_message_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .single();

  const cutoffId = blackboard?.summary_to_message_id;

  let query = db
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .neq('role', 'system')
    .order('created_at', { ascending: true });

  if (cutoffId) {
    const { data: cutoffMsg } = await db
      .from('messages')
      .select('created_at')
      .eq('id', cutoffId)
      .single();
    if (cutoffMsg) {
      query = query.gt('created_at', cutoffMsg.created_at) as any;
    }
  }

  const { data } = await query;
  return data || [];
}

// ============================================
// USER MESSAGE COUNT (for summarization trigger)
// ============================================
export async function getUserMessageCount(
  conversationId: string,
  userId: string
): Promise<number> {
  const { createServiceRoleClient } = await import('@/lib/supabase');
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

// ============================================
// TOTAL TOKEN SAVINGS FOR USER
// ============================================
export async function getTotalTokenSavingsForUser(userId: string): Promise<number> {
  const { createServiceRoleClient } = await import('@/lib/supabase');
  const db = createServiceRoleClient();

  const { data } = await db
    .from('blackboard')
    .select('total_tokens_saved')
    .eq('user_id', userId);

  return (data || []).reduce((sum, row) => sum + (row.total_tokens_saved || 0), 0);
}
