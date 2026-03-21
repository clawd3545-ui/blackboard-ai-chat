import { createBrowserClient as createSSRBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// ============================================
// BROWSER CLIENT — cookie-based sessions
// ============================================
export function createBrowserClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ============================================
// ROUTE HANDLER CLIENT (API Routes)
// ============================================
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

// ============================================
// SERVICE ROLE CLIENT (Server only — bypasses RLS)
// ============================================
export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ============================================
// AUTH HELPER — verifies user server-side
// USE THIS in API routes instead of getSession()
// getSession() trusts client-side cookie data (insecure)
// getUser() verifies JWT with Supabase auth server (secure)
// ============================================
export async function getAuthUser(request: NextRequest, response: NextResponse) {
  const supabase = createRouteHandlerClient(request, response);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}
