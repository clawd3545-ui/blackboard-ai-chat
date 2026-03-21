import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase';

// GET /api/blackboard/savings
// Returns total token savings for the authenticated user
export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createServiceRoleClient();
    const { data } = await db
      .from('blackboard')
      .select('total_tokens_saved, message_count, original_tokens, summarized_tokens')
      .eq('user_id', session.user.id);

    const totalSaved = (data || []).reduce((sum, row) => sum + (row.total_tokens_saved || 0), 0);
    const totalMessages = (data || []).reduce((sum, row) => sum + (row.message_count || 0), 0);
    const totalOriginal = (data || []).reduce((sum, row) => sum + (row.original_tokens || 0), 0);
    const conversations = (data || []).length;

    return NextResponse.json({
      success: true,
      totalSaved,
      totalMessages,
      totalOriginal,
      conversations,
      percentageSaved: totalOriginal > 0 ? Math.round((totalSaved / totalOriginal) * 100) : 0,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
