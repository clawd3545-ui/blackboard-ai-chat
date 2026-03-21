// ============================================
// BLACKBOARD PATTERN UTILITIES
// Token counting and summarization helpers
// ============================================

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Rough token count estimator
 * Approximation: ~4 chars per token for English text
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens across a set of messages
 */
export function countMessageTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => {
    return total + estimateTokenCount(msg.content) + 4; // +4 for role/format overhead
  }, 0);
}

/**
 * Calculate token savings from summarization
 */
export function calculateTokenSavings(
  originalMessages: Message[],
  summary: string
): {
  originalTokens: number;
  summarizedTokens: number;
  tokensSaved: number;
  percentageSaved: number;
} {
  const originalTokens = countMessageTokens(originalMessages);
  const summarizedTokens = estimateTokenCount(summary);
  const tokensSaved = Math.max(0, originalTokens - summarizedTokens);
  const percentageSaved =
    originalTokens > 0
      ? Math.round((tokensSaved / originalTokens) * 100)
      : 0;

  return {
    originalTokens,
    summarizedTokens,
    tokensSaved,
    percentageSaved,
  };
}

/**
 * Check if a conversation should be summarized
 */
export function shouldSummarize(
  messageCount: number,
  role: "user" | "assistant" | "system" = "user",
  threshold = 5
): boolean {
  if (role !== "user") return false;
  return messageCount > 0 && messageCount % threshold === 0;
}

/**
 * Get the count of user messages in a conversation
 */
export async function getUserMessageCount(
  conversationId: string,
  userId: string
): Promise<number> {
  const { createServiceRoleClient } = await import("@/lib/supabase");
  const serviceClient = createServiceRoleClient();

  const { count, error } = await serviceClient
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .eq("role", "user");

  if (error) {
    console.error("Error counting user messages:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get total token savings for a user across all conversations
 */
export async function getTotalTokenSavingsForUser(
  userId: string
): Promise<number> {
  const { createServiceRoleClient } = await import("@/lib/supabase");
  const serviceClient = createServiceRoleClient();

  const { data, error } = await serviceClient
    .from("blackboard")
    .select("total_tokens_saved")
    .eq("user_id", userId);

  if (error) {
    console.error("Error getting total token savings:", error);
    return 0;
  }

  return (data || []).reduce(
    (sum, row) => sum + (row.total_tokens_saved || 0),
    0
  );
}
