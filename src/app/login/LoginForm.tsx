"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle, ArrowRight, Mail } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"social" | "email">("social");
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(nextPath);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) router.replace(nextPath);
    });
    return () => subscription.unsubscribe();
  }, []);

  const clear = () => { setError(null); setSuccess(null); };

  const handleGoogleLogin = async () => {
    clear(); setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    });
    if (error) { setError(error.message); setIsGoogleLoading(false); }
  };

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault(); clear();
    if (!email.trim()) { setError("Email is required"); return; }
    if (!password) { setError("Password is required"); return; }
    setIsLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (error.message.includes("Invalid login credentials")) setError("Wrong email or password.");
          else if (error.message.includes("Email not confirmed")) setError("Please confirm your email first.");
          else setError(error.message);
          return;
        }
        router.replace(nextPath);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
        });
        if (error) { setError(error.message); return; }
        if (data.session) { router.replace(nextPath); return; }
        if (data.user && !data.user.identities?.length) {
          setError("Account already exists. Switch to Login."); return;
        }
        setSuccess("Account created! Check your email, then log in.");
        setTimeout(() => { setMode("login"); setSuccess(null); }, 4000);
      }
    } catch { setError("Something went wrong."); }
    finally { setIsLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lp-root {
          min-height: 100vh;
          background: #0c0c0e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', -apple-system, sans-serif;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        /* Subtle noise texture */
        .lp-root::before {
          content: '';
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          opacity: 0.4;
          pointer-events: none;
        }

        /* Very faint radial glow behind card */
        .lp-root::after {
          content: '';
          position: absolute;
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .lp-card {
          position: relative; z-index: 1;
          width: 100%; max-width: 400px;
          background: #111114;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 40px 36px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03),
            0 20px 60px rgba(0,0,0,0.6),
            0 1px 0 rgba(255,255,255,0.05) inset;
          animation: fadeUp 0.4s ease;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Logo */
        .logo-wrap {
          display: flex; justify-content: center;
          margin-bottom: 28px;
        }
        .logo-box {
          width: 48px; height: 48px;
          background: linear-gradient(135deg, #1e1e28, #2a2a38);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.15);
        }
        .logo-inner {
          width: 26px; height: 26px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
        }
        .logo-inner svg { width: 14px; height: 14px; }

        /* Heading */
        .lp-title {
          text-align: center;
          font-size: 22px;
          font-weight: 600;
          color: #f4f4f5;
          margin-bottom: 6px;
          letter-spacing: -0.3px;
        }
        .lp-sub {
          text-align: center;
          font-size: 13.5px;
          color: rgba(255,255,255,0.32);
          margin-bottom: 28px;
          font-weight: 400;
          line-height: 1.5;
        }

        /* Mode toggle */
        .mode-row {
          display: flex; justify-content: center; gap: 4px;
          margin-bottom: 24px;
        }
        .mode-btn {
          padding: 6px 18px; border: none; cursor: pointer;
          font-size: 13px; font-weight: 500;
          font-family: 'Inter', sans-serif;
          border-radius: 8px; transition: all 0.15s;
          background: transparent; color: rgba(255,255,255,0.35);
        }
        .mode-btn.active {
          background: rgba(99,102,241,0.15);
          color: #818cf8;
        }
        .mode-btn:hover:not(.active) { color: rgba(255,255,255,0.6); }

        /* Social buttons */
        .social-btn {
          width: 100%; padding: 12px 16px;
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; cursor: pointer;
          font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.82);
          font-family: 'Inter', sans-serif;
          transition: all 0.15s; margin-bottom: 10px;
          text-align: left;
        }
        .social-btn:last-of-type { margin-bottom: 0; }
        .social-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.13);
          color: #fff;
        }
        .social-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .social-icon {
          width: 32px; height: 32px;
          background: rgba(255,255,255,0.06);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        /* Divider */
        .divider {
          display: flex; align-items: center; gap: 12px;
          margin: 20px 0;
        }
        .div-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .div-txt { font-size: 12px; color: rgba(255,255,255,0.22); white-space: nowrap; }

        /* Email section */
        .email-section { }

        .inp-label {
          font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.4);
          display: block; margin-bottom: 7px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .inp-wrap { position: relative; margin-bottom: 12px; }
        .inp-wrap svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); opacity: 0.3; width: 15px; height: 15px; }
        .lp-input {
          width: 100%; padding: 11px 40px 11px 38px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; color: #e4e4e7;
          font-size: 14px; font-family: 'Inter', sans-serif;
          transition: all 0.15s; outline: none;
        }
        .lp-input::placeholder { color: rgba(255,255,255,0.2); }
        .lp-input:focus {
          border-color: rgba(99,102,241,0.45);
          background: rgba(99,102,241,0.05);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
        }
        .lp-input:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Arrow icon on right of email input */
        .inp-arrow {
          position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
          width: 26px; height: 26px;
          background: rgba(99,102,241,0.2);
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          color: #818cf8;
        }
        .inp-arrow svg { width: 13px; height: 13px; }

        /* Main CTA button */
        .lp-btn {
          width: 100%; padding: 12px;
          background: #ffffff;
          border: none; border-radius: 10px; cursor: pointer;
          font-size: 14px; font-weight: 600; color: #0c0c0e;
          font-family: 'Inter', sans-serif;
          transition: all 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          margin-top: 4px;
        }
        .lp-btn:hover:not(:disabled) { background: #e4e4e7; }
        .lp-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Hint */
        .hint-txt {
          font-size: 11.5px; color: rgba(255,255,255,0.18);
          margin-top: 7px;
        }

        /* Alerts */
        .alert {
          display: flex; align-items: flex-start; gap: 9px;
          padding: 11px 13px; border-radius: 10px;
          font-size: 13px; line-height: 1.5; margin-bottom: 16px;
        }
        .alert svg { flex-shrink: 0; margin-top: 1px; width: 14px; height: 14px; }
        .alert.err { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15); color: #fca5a5; }
        .alert.ok  { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.15); color: #6ee7b7; }

        /* Footer link */
        .lp-footer {
          text-align: center; margin-top: 22px;
          font-size: 12px; color: rgba(255,255,255,0.18);
        }
        .lp-footer a { color: rgba(255,255,255,0.35); cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
        .lp-footer a:hover { color: rgba(255,255,255,0.55); }

        .spin { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="lp-root">
        <div className="lp-card">

          {/* Logo */}
          <div className="logo-wrap">
            <div className="logo-box">
              <div className="logo-inner">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="lp-title">
            {mode === "login" ? "Welcome back" : "Create account"}
          </div>
          <div className="lp-sub">
            {mode === "login" ? "Sign in to NexChat" : "Start chatting with AI in seconds"}
          </div>

          {/* Mode toggle */}
          <div className="mode-row">
            <button className={`mode-btn ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); clear(); }}>Login</button>
            <button className={`mode-btn ${mode === "signup" ? "active" : ""}`} onClick={() => { setMode("signup"); clear(); }}>Sign up</button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="alert err">
              <AlertCircle />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert ok">
              <CheckCircle />
              <span>{success}</span>
            </div>
          )}

          {/* Google */}
          <button className="social-btn" onClick={handleGoogleLogin} disabled={isGoogleLoading || isLoading}>
            <div className="social-icon">
              {isGoogleLoading
                ? <Loader2 size={16} className="spin" color="rgba(255,255,255,0.6)" />
                : <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
              }
            </div>
            {isGoogleLoading ? "Redirecting to Google..." : `${mode === "login" ? "Login" : "Sign up"} with Google`}
          </button>

          {/* Divider */}
          <div className="divider">
            <div className="div-line" />
            <span className="div-txt">or continue with email</span>
            <div className="div-line" />
          </div>

          {/* Email + Password form */}
          <form onSubmit={handleEmailContinue} className="email-section">
            <label className="inp-label">Email</label>
            <div className="inp-wrap" style={{marginBottom: 12}}>
              <Mail color="white" />
              <input
                className="lp-input"
                type="email"
                placeholder="enter your email address..."
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                style={{paddingRight: 44}}
              />
              <div className="inp-arrow"><ArrowRight /></div>
            </div>

            <label className="inp-label">Password</label>
            <div className="inp-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                className="lp-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            {mode === "signup" && <div className="hint-txt">Minimum 6 characters</div>}

            <button className="lp-btn" type="submit" disabled={isLoading || isGoogleLoading} style={{marginTop: 16}}>
              {isLoading
                ? <><Loader2 size={15} className="spin" />{mode === "login" ? "Signing in..." : "Creating account..."}</>
                : mode === "login" ? "Login with email" : "Create account"
              }
            </button>
          </form>

          {/* Footer */}
          <div className="lp-footer">
            {mode === "login"
              ? <>Don't have an account? <a onClick={() => { setMode("signup"); clear(); }}>Sign up free</a></>
              : <>Already have an account? <a onClick={() => { setMode("login"); clear(); }}>Login</a></>
            }
          </div>

        </div>
      </div>
    </>
  );
}
