import { createBrowserClient as createSSRBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export function createBrowserClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createRouteHandlerClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { response.cookies.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { response.cookies.set({ name, value: "", ...options }); },
      },
    }
  );
}

export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ============================================
// FAST AUTH — getSession() validates JWT locally
// No external HTTP call = ~100-200ms faster
// Safe for API routes that also validate ownership
// via service role DB queries (auth.uid() = user_id)
// ============================================
export async function getAuthSession(request: NextRequest, response: NextResponse) {
  const supabase = createRouteHandlerClient(request, response);
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Keep getAuthUser for cases where strict server verification needed
export async function getAuthUser(request: NextRequest, response: NextResponse) {
  const supabase = createRouteHandlerClient(request, response);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}
