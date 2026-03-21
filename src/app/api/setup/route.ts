import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { pat } = await request.json();
  if (!pat) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const PROJECT = 'hpvcfizzwljhrioacykn';

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/config/auth`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      site_url: 'https://blackboard-ai-chat.vercel.app',
      uri_allow_list: 'https://blackboard-ai-chat.vercel.app/**,https://blackboard-ai-chat.vercel.app/auth/callback,https://blackboard-ai-chat-git-main-blackbord.vercel.app/**,https://blackboard-ai-chat-blackbord.vercel.app/**',
      mailer_autoconfirm: true,
      external_google_enabled: true,
      external_google_client_id: process.env.GOOGLE_CLIENT_ID,
      external_google_secret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  });

  const data = await res.json();
  return NextResponse.json({ http_status: res.status, site_url: data.site_url, autoconfirm: data.mailer_autoconfirm, google: data.external_google_enabled, error: data.message || null });
}
