// ============================================
// BLACKBOARD CORE — Token-saving conversation memory
// USP: Summarize old messages → send only recent ones
// This saves 60-90% tokens on long conversations
// ============================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface BlackboardEntry {
  id: string;
  summary: string;
  summary_to_message_id: string | null;
  message_count: number;
  total_tokens_saved: number;
  original_tokens: number;
  summarized_tokens: number;
}

export interface ConversationContext {
  summary: string | null;
  summaryToMessageId: string | null;
  recentMessages: Message[];  // ONLY messages after summary cutoff
  totalTokensSaved: number;
}

// ============================================
// TOKEN ESTIMATION
// GPT-4o-mini: ~4 chars per token (English)
// Add overhead per message: role + formatting
// ============================================
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // More accurate: count words*1.3 + punctuation
  const words = text.split(/\s+/).length;
  const chars = text.length;
  return Math.ceil((words * 1.3 + chars * 0.1) / 2);
}

export function estimateMessagesTokenCount(messages: Message[]): number {
  return messages.reduce((total, msg) => {
    return total
      + estimateTokenCount(msg.content)
      + 4; // role + formatting overhead per message
  }, 3); // base prompt overhead
}

// ============================================
// SUMMARIZATION TRIGGER
// Fire after every 5 USER messages
// ============================================
export function shouldSummarize(userMessageCount: number): boolean {
  return userMessageCount > 0 && userMessageCount % 5 === 0;
}

// ============================================
// TOKEN SAVINGS CALCULATOR
// Compare original vs summarized token count
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
// CONVERSATION CONTEXT BUILDER
// THE CORE OF BLACKBOARD:
// Returns summary + ONLY messages after cutoff
// NOT all messages — this is what saves tokens
// ============================================
export async function getConversationContext(
  conversationId: string,
  userId: string
): Promise<ConversationContext> {
  const { createServiceRoleClient } = await import('@/lib/supabase');
  const db = createServiceRoleClient();

  // Get blackboard entry (summary + where we left off)
  const { data: blackboard } = await db
    .from('blackboard')
    .select('summary, summary_to_message_id, total_tokens_saved')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .single();

  const summaryToMessageId = blackboard?.summary_to_message_id || null;

  // Get ONLY messages AFTER the summary cutoff
  // This is the key: we don't send old messages, only new ones
  let messagesQuery = db
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (summaryToMessageId) {
    // Get the cutoff timestamp
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

  const recentMessages: Message[] = (messagesData || []).map((m: any) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  return {
    summary: blackboard?.summary || null,
    summaryToMessageId,
    recentMessages,
    totalTokensSaved: blackboard?.total_tokens_saved || 0,
  };
}

// ============================================
// GET MESSAGES TO SUMMARIZE
// Returns ALL unsummarized messages
// ============================================
export async function getUnsummarizedMessages(
  conversationId: string,
  userId: string
): Promise<{ id: string; role: string; content: string }[]> {
  const { createServiceRoleClient } = await import('@/lib/supabase');
  const db = createServiceRoleClient();

  // Get current summary cutoff
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
// USER MESSAGE COUNT
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
