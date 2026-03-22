import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createServiceRoleClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  try {
    const user = await getAuthUser(request, response);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createServiceRoleClient();

    // Call the DB function — handles monthly reset automatically
    const { data, error } = await db.rpc('get_user_plan_info', { p_user_id: user.id });
    if (error) throw error;

    const info = data?.[0];
    if (!info) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const percentUsed = info.monthly_limit === -1
      ? 0
      : Math.round((info.messages_this_month / info.monthly_limit) * 100);

    return NextResponse.json({
      plan: info.plan,                          // 'free' | 'pro'
      messagesUsed: info.messages_this_month,   // e.g. 45
      monthlyLimit: info.monthly_limit,         // 100 (free) | -1 (unlimited)
      isWithinLimit: info.is_within_limit,      // true/false
      percentUsed,                              // 0-100
      resetAt: info.messages_reset_at,          // ISO date of next reset
      isPro: info.plan === 'pro',
    });
  } catch (error) {
    console.error('[Plan] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
