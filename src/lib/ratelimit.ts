// Simple rate limiter using Supabase for persistence
// Falls back gracefully on error — never blocks legitimate users
import { createServiceRoleClient } from "@/lib/supabase";

const LIMITS = {
  chat: { requests: 30, windowSeconds: 60 },     // 30 msgs/min
  keys: { requests: 20, windowSeconds: 60 },      // 20 key ops/min
  payment: { requests: 5, windowSeconds: 60 },    // 5 payment attempts/min
};

export async function checkRateLimit(
  userId: string,
  action: keyof typeof LIMITS
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const limit = LIMITS[action];
    const windowStart = new Date(Date.now() - limit.windowSeconds * 1000).toISOString();
    const db = createServiceRoleClient();

    // Count recent actions
    const { count } = await db
      .from("usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action_type", action)
      .gte("created_at", windowStart);

    const used = count || 0;
    const allowed = used < limit.requests;
    const remaining = Math.max(0, limit.requests - used - 1);

    if (allowed) {
      // Log this request (fire-and-forget)
      void db.from("usage_logs").insert({ user_id: userId, action_type: action });
    }

    return { allowed, remaining };
  } catch {
    // Fail open — don't block users if rate limit check fails
    return { allowed: true, remaining: 999 };
  }
}
