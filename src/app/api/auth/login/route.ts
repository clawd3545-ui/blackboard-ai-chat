import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { email, password, action = 'login' } = await request.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    const authResult = action === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${request.headers.get('origin')}/auth/callback` } })
      : await supabase.auth.signInWithPassword({ email, password });

    const { data, error } = authResult;
    if (error) {
      if (error.message.includes('Invalid login credentials')) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      if (error.message.includes('Email not confirmed')) return NextResponse.json({ error: 'Please confirm your email before logging in' }, { status: 401 });
      if (error.message.includes('User already registered')) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data.session) return NextResponse.json({ error: 'No session created' }, { status: 500 });

    return NextResponse.json({
      success: true,
      user: { id: data.user?.id, email: data.user?.email },
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at },
      message: action === 'signup' ? 'Account created successfully! Please check your email to confirm.' : 'Logged in successfully!',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
    return NextResponse.json({ authenticated: true, user: { id: session.user.id, email: session.user.email }, expires_at: session.expires_at });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
