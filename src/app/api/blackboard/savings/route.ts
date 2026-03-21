import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createServiceRoleClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  try {
    const user = await getAuthUser(request, response);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createServiceRoleClient();
    const { data } = await db.from('blackboard')
      .select('total_tokens_saved, message_count, original_tokens, summarized_tokens')
      .eq('user_id', user.id);

    const totalSaved = (data || []).reduce((sum, r) => sum + (r.total_tokens_saved || 0), 0);
    const totalMessages = (data || []).reduce((sum, r) => sum + (r.message_count || 0), 0);
    const totalOriginal = (data || []).reduce((sum, r) => sum + (r.original_tokens || 0), 0);

    return NextResponse.json({
      success: true,
      totalSaved,
      totalMessages,
      totalOriginal,
      conversations: (data || []).length,
      percentageSaved: totalOriginal > 0 ? Math.round((totalSaved / totalOriginal) * 100) : 0,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
