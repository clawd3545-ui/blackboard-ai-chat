import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  // Always redirect to canonical production URL, not whatever URL the callback came from
  const CANONICAL = process.env.NEXT_PUBLIC_APP_URL || "https://blackboard-ai-chat.vercel.app";

  if (error) {
    return NextResponse.redirect(`${CANONICAL}/login?error=${encodeURIComponent(errorDesc || error)}`);
  }

  if (code) {
    // Exchange the code — cookies must be set on the canonical domain
    const response = NextResponse.redirect(`${CANONICAL}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      return response;
    }
    console.error("Auth callback exchange error:", exchangeError.message);
    return NextResponse.redirect(`${CANONICAL}/login?error=${encodeURIComponent(exchangeError.message)}`);
  }

  return NextResponse.redirect(`${CANONICAL}/login?error=No+auth+code+received`);
}
