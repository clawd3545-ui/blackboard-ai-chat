import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase';
import { serverDecrypt } from '@/lib/encryption';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { shouldSummarize, getUserMessageCount } from '@/lib/blackboard';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

async function getUserApiKey(userId: string): Promise<string | null> {
  try {
    const s = createServiceRoleClient();
    const { data, error } = await s.from('api_keys').select('*').eq('user_id', userId).eq('provider', 'openai').eq('is_active', true).single();
    if (error || !data) return null;
    return await serverDecrypt({ encryptedKey: data.encrypted_key, iv: data.iv, tag: data.tag, salt: data.salt });
  } catch { return null; }
}

async function getConversationContext(conversationId: string, userId: string): Promise<{ summary: string | null; messages: ChatMessage[] }> {
  try {
    const s = createServiceRoleClient();
    const { data: blackboardData } = await s.from('blackboard').select('summary').eq('conversation_id', conversationId).eq('user_id', userId).single();
    const { data: messagesData, error } = await s.from('messages').select('*').eq('conversation_id', conversationId).eq('user_id', userId).order('created_at', { ascending: true }).limit(10);
    if (error) return { summary: null, messages: [] };
    const messages: ChatMessage[] = (messagesData || []).map((msg: any) => ({ role: msg.role as 'user' | 'assistant' | 'system', content: msg.content }));
    return { summary: blackboardData?.summary || null, messages };
  } catch { return { summary: null, messages: [] }; }
}

async function saveMessage(conversationId: string, userId: string, role: string, content: string, tokensUsed = 0) {
  try {
    await createServiceRoleClient().from('messages').insert({ conversation_id: conversationId, user_id: userId, role, content, tokens_used: tokensUsed });
  } catch (error) { console.error('Error saving message:', error); }
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;
    const { message, conversationId, model = 'gpt-4o-mini', systemPrompt } = await request.json();
    if (!message || typeof message !== 'string') return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const apiKey = await getUserApiKey(userId);
    if (!apiKey) return NextResponse.json({ error: 'No API key found', message: 'Please add your OpenAI API key in settings to start chatting.' }, { status: 400 });

    if (conversationId) {
      const { data: conversation, error: convError } = await createServiceRoleClient().from('conversations').select('id').eq('id', conversationId).eq('user_id', userId).single();
      if (convError || !conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { summary, messages: previousMessages } = conversationId
      ? await getConversationContext(conversationId, userId)
      : { summary: null, messages: [] as ChatMessage[] };

    let systemContent = systemPrompt || 'You are a helpful AI assistant.';
    if (summary) systemContent += `\n\nHere is a summary of the previous conversation context:\n${summary}`;

    const aiMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...previousMessages,
      { role: 'user', content: message },
    ];

    if (conversationId) await saveMessage(conversationId, userId, 'user', message);

    const openaiClient = createOpenAI({ apiKey });
    const result = await streamText({
      model: openaiClient(model),
      messages: aiMessages,
      onFinish: async (completion) => {
        if (conversationId) {
          await saveMessage(conversationId, userId, 'assistant', completion.text, completion.usage?.totalTokens || 0);
          const userMessageCount = await getUserMessageCount(conversationId, userId);
          if (shouldSummarize(userMessageCount, 'user')) {
            setTimeout(async () => {
              try {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                await fetch(`${baseUrl}/api/summarize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, userId }) });
              } catch (err) { console.error('[Blackboard] Summarization failed:', err); }
            }, 0);
          }
        }
      },
    });

    return result.toAIStreamResponse();
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    if (!conversationId) return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    const { data: messages, error } = await createServiceRoleClient().from('messages').select('*').eq('conversation_id', conversationId).eq('user_id', session.user.id).order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
