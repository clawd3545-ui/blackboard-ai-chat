import { createBrowserClient as createSSRBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Browser client (cookie-based sessions)
export function createBrowserClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Route handler client (per-request, for cookie auth)
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

// Singleton service role client (bypasses RLS — server only)
let _serviceRoleClient: SupabaseClient | null = null;
export function createServiceRoleClient(): SupabaseClient {
  if (_serviceRoleClient) return _serviceRoleClient;
  _serviceRoleClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return _serviceRoleClient;
}

// ============================================
// AUTH HELPERS
// getAuthSession: fast local JWT validation (no network call)
//   → safe when you also verify ownership via service role queries
//   → used by: /api/keys, /api/blackboard/savings
// getAuthUser: server-verified (network call to Supabase auth)
//   → use for sensitive operations: chat, payments, plan changes
//   → slightly slower but tamper-proof
// ============================================

export async function getAuthSession(request: NextRequest, response: NextResponse) {
  const supabase = createRouteHandlerClient(request, response);
  const { data: { session } } = await supabase.auth.getSession();
  return session; // returns null if not logged in
}

export async function getAuthUser(request: NextRequest, response: NextResponse) {
  const supabase = createRouteHandlerClient(request, response);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user; // server-verified, tamper-proof
}
