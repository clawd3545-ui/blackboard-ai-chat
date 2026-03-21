"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, UserPlus, LogIn, Bot, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push(redirectTo);
    };
    checkSession();
  }, [router, redirectTo, supabase]);

  useEffect(() => { setError(null); }, [email, password, activeTab]);

  const validateForm = (): boolean => {
    if (!email.trim()) { setError("Email is required"); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError("Please enter a valid email address"); return false; }
    if (!password) { setError("Password is required"); return false; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return false; }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true); setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, action: "login" }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Login failed"); return; }
      if (data.session) {
        await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      }
      router.push(redirectTo);
    } catch { setError("An unexpected error occurred."); }
    finally { setIsLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true); setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, action: "signup" }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Signup failed"); return; }
      setSuccessMessage(data.message || "Account created! Please check your email.");
      setEmail(""); setPassword("");
      setTimeout(() => { setActiveTab("login"); setSuccessMessage(null); }, 3000);
    } catch { setError("An unexpected error occurred."); }
    finally { setIsLoading(false); }
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
        <div className="bg-card border rounded-lg shadow-sm">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="flex items-center gap-2"><LogIn className="h-4 w-4" />Login</TabsTrigger>
              <TabsTrigger value="signup" className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Sign Up</TabsTrigger>
            </TabsList>
            {error && (
              <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {successMessage && (
              <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            )}
            <TabsContent value="login" className="p-6 pt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" disabled={isLoading} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" disabled={isLoading} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
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
                    <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" disabled={isLoading} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="signup-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" disabled={isLoading} />
                  </div>
                  <p className="text-xs text-muted-foreground">Password must be at least 6 characters</p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating account...</> : <><UserPlus className="h-4 w-4 mr-2" />Create Account</>}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg bg-card border"><div className="text-2xl">🔒</div><p className="text-xs text-muted-foreground mt-1">Encrypted Keys</p></div>
          <div className="p-4 rounded-lg bg-card border"><div className="text-2xl">🧠</div><p className="text-xs text-muted-foreground mt-1">Smart Context</p></div>
          <div className="p-4 rounded-lg bg-card border"><div className="text-2xl">⚡</div><p className="text-xs text-muted-foreground mt-1">Streaming</p></div>
        </div>
      </div>
    </div>
  );
}
