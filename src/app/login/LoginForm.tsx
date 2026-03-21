"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, UserPlus, LogIn, Bot, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createBrowserClient } from "@/lib/supabase";

// Always use the canonical production URL for OAuth redirects
// Using window.location.origin causes issues on old deployment-specific URLs
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || (
  typeof window !== "undefined" ? window.location.origin : ""
);

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nextPath = searchParams.get("redirectTo") || "/dashboard";

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) setError(decodeURIComponent(urlError));
  }, [searchParams]);

  useEffect(() => {
    // On mount, check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(nextPath);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.replace(nextPath);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const clear = () => { setError(null); setSuccess(null); };

  const handleGoogleLogin = async () => {
    clear();
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // ALWAYS use canonical URL — never window.location.origin
        redirectTo: `${SITE_URL}/auth/callback`,
      },
    });
    if (error) { setError(error.message); setIsGoogleLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clear();
    if (!email.trim()) { setError("Email is required"); return; }
    if (!password) { setError("Password is required"); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Wrong email or password. Try again.");
        } else if (error.message.includes("Email not confirmed")) {
          setError("Please confirm your email first — check your inbox.");
        } else {
          setError(error.message);
        }
        return;
      }
      router.replace(nextPath);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clear();
    if (!email.trim()) { setError("Email is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${SITE_URL}/auth/callback`,
        },
      });
      if (error) { setError(error.message); return; }

      // Session returned = email confirmation OFF, logged in directly
      if (data.session) {
        router.replace(nextPath);
        return;
      }

      // No identities = email already exists
      if (data.user && !data.user.identities?.length) {
        setError("Account already exists with this email. Please log in.");
        setActiveTab("login");
        return;
      }

      // Email confirmation required
      setSuccess("Account created! Check your email and click the confirmation link, then log in here.");
      setEmail(""); setPassword("");
      setTimeout(() => setActiveTab("login"), 4000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary mb-4">
            <Bot className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Blackboard AI Chat</h1>
          <p className="text-muted-foreground mt-2">Secure AI conversations with context awareness</p>
        </div>

        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          {/* Google */}
          <div className="p-6 pb-0">
            <Button onClick={handleGoogleLogin} disabled={isGoogleLoading || isLoading}
              variant="outline" className="w-full h-11 flex items-center justify-center gap-3 font-medium">
              {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {isGoogleLoading ? "Redirecting to Google..." : "Continue with Google"}
            </Button>
          </div>

          <div className="flex items-center gap-3 px-6 py-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "login" | "signup"); clear(); }}>
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login"><LogIn className="h-4 w-4 mr-2" />Login</TabsTrigger>
                <TabsTrigger value="signup"><UserPlus className="h-4 w-4 mr-2" />Sign Up</TabsTrigger>
              </TabsList>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {success && (
              <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            <TabsContent value="login" className="p-6 pt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="you@example.com" value={email}
                      onChange={e => setEmail(e.target.value)} className="pl-10" disabled={isLoading} autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="login-password" type="password" placeholder="••••••••" value={password}
                      onChange={e => setPassword(e.target.value)} className="pl-10" disabled={isLoading} autoComplete="current-password" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Logging in...</> : <><LogIn className="h-4 w-4 mr-2" />Login</>}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="p-6 pt-4">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="signup-email" type="email" placeholder="you@example.com" value={email}
                      onChange={e => setEmail(e.target.value)} className="pl-10" disabled={isLoading} autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="signup-password" type="password" placeholder="••••••••" value={password}
                      onChange={e => setPassword(e.target.value)} className="pl-10" disabled={isLoading} autoComplete="new-password" />
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating account...</> : <><UserPlus className="h-4 w-4 mr-2" />Create Account</>}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-card border"><div className="text-xl">🔒</div><p className="text-xs text-muted-foreground mt-1">Encrypted Keys</p></div>
          <div className="p-3 rounded-lg bg-card border"><div className="text-xl">🧠</div><p className="text-xs text-muted-foreground mt-1">Smart Context</p></div>
          <div className="p-3 rounded-lg bg-card border"><div className="text-xl">⚡</div><p className="text-xs text-muted-foreground mt-1">Streaming</p></div>
        </div>
      </div>
    </div>
  );
}
