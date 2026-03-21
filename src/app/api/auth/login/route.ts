import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { email, password, action = 'login' } = await request.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });

    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${request.headers.get('origin')}/auth/callback` },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // If user already exists, Supabase returns identities=[] — tell them to log in instead
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return NextResponse.json({ error: 'An account with this email already exists. Please log in instead.' }, { status: 409 });
      }

      return NextResponse.json({
        success: true,
        message: 'Account created! Please check your email to confirm before logging in.',
        user: { id: data.user?.id, email: data.user?.email },
        // no session yet - email confirmation required
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        } : null,
      });
    }

    // LOGIN
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      if (error.message.includes('Email not confirmed')) return NextResponse.json({ error: 'Please confirm your email first. Check your inbox.' }, { status: 401 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data.session) return NextResponse.json({ error: 'Login failed — no session created' }, { status: 500 });

    return NextResponse.json({
      success: true,
      message: 'Logged in successfully!',
      user: { id: data.user?.id, email: data.user?.email },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    await supabase.auth.signOut();
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return NextResponse.json({ authenticated: false }, { status: 401 });
    return NextResponse.json({ authenticated: true, user: { id: session.user.id, email: session.user.email }, expires_at: session.expires_at });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
