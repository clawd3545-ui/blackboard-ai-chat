"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, UserPlus, LogIn, AlertCircle, CheckCircle, Sparkles, Brain, Zap, Shield } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

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
  const [mounted, setMounted] = useState(false);

  const nextPath = searchParams.get("redirectTo") || "/dashboard";

  useEffect(() => {
    setMounted(true);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clear();
    if (!email.trim()) { setError("Email is required"); return; }
    if (!password) { setError("Password is required"); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (error.message.includes("Invalid login credentials")) setError("Wrong email or password.");
        else if (error.message.includes("Email not confirmed")) setError("Please confirm your email first.");
        else setError(error.message);
        return;
      }
      router.replace(nextPath);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setIsLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); clear();
    if (!email.trim()) { setError("Email is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
      });
      if (error) { setError(error.message); return; }
      if (data.session) { router.replace(nextPath); return; }
      if (data.user && !data.user.identities?.length) {
        setError("Account already exists. Please log in."); setActiveTab("login"); return;
      }
      setSuccess("Account created! Check your email to confirm, then log in.");
      setEmail(""); setPassword("");
      setTimeout(() => setActiveTab("login"), 4000);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setIsLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .login-root {
          min-height: 100vh;
          background: #020817;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
          position: relative;
        }

        /* Animated background orbs */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          animation: float 8s ease-in-out infinite;
        }
        .orb-1 { width: 500px; height: 500px; background: #3b82f6; top: -100px; left: -100px; animation-delay: 0s; }
        .orb-2 { width: 400px; height: 400px; background: #8b5cf6; bottom: -50px; right: 30%; animation-delay: -3s; }
        .orb-3 { width: 300px; height: 300px; background: #06b6d4; top: 40%; right: 10%; animation-delay: -6s; }

        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }

        /* Grid overlay */
        .grid-overlay {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 50px 50px;
          mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
        }

        /* Left panel */
        .left-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 80px;
          position: relative;
          z-index: 10;
        }

        .brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 100px;
          padding: 6px 14px;
          margin-bottom: 40px;
          width: fit-content;
        }
        .brand-badge span {
          font-size: 12px;
          color: #60a5fa;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .hero-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(42px, 4vw, 64px);
          font-weight: 800;
          line-height: 1.05;
          color: #fff;
          margin-bottom: 24px;
        }
        .hero-title .gradient-text {
          background: linear-gradient(135deg, #60a5fa, #a78bfa, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-desc {
          font-size: 18px;
          color: rgba(255,255,255,0.5);
          line-height: 1.7;
          max-width: 440px;
          margin-bottom: 56px;
          font-weight: 300;
        }

        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 16px;
          opacity: 0;
          animation: slideIn 0.6s ease forwards;
        }
        .feature-item:nth-child(1) { animation-delay: 0.1s; }
        .feature-item:nth-child(2) { animation-delay: 0.2s; }
        .feature-item:nth-child(3) { animation-delay: 0.3s; }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .feature-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .feature-icon.blue { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .feature-icon.purple { background: rgba(139,92,246,0.15); color: #a78bfa; }
        .feature-icon.green { background: rgba(52,211,153,0.15); color: #34d399; }

        .feature-text h4 {
          font-size: 15px; font-weight: 500; color: #fff; margin-bottom: 2px;
        }
        .feature-text p {
          font-size: 13px; color: rgba(255,255,255,0.4); font-weight: 300;
        }

        /* Right panel - form */
        .right-panel {
          width: 480px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          position: relative;
          z-index: 10;
        }

        .form-card {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 40px;
          backdrop-filter: blur(20px);
          box-shadow: 0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .form-header {
          margin-bottom: 32px;
        }
        .form-header h2 {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }
        .form-header p {
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          font-weight: 300;
        }

        /* Tab switcher */
        .tab-switcher {
          display: flex;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 28px;
          gap: 4px;
        }
        .tab-btn {
          flex: 1; padding: 10px; border: none;
          border-radius: 9px; cursor: pointer;
          font-size: 14px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s ease;
          background: transparent;
          color: rgba(255,255,255,0.4);
        }
        .tab-btn.active {
          background: rgba(59,130,246,0.2);
          color: #60a5fa;
          box-shadow: 0 0 0 1px rgba(59,130,246,0.3);
        }
        .tab-btn:hover:not(.active) { color: rgba(255,255,255,0.7); }

        /* Google btn */
        .google-btn {
          width: 100%; padding: 13px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          font-size: 15px; font-weight: 500; color: #fff;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s ease;
          margin-bottom: 24px;
        }
        .google-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-1px);
        }
        .google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Divider */
        .divider {
          display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
        }
        .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
        .divider span { font-size: 12px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.1em; }

        /* Form inputs */
        .form-group { margin-bottom: 16px; }
        .form-label {
          display: block; font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,0.6); margin-bottom: 8px;
        }
        .input-wrap { position: relative; }
        .input-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: rgba(255,255,255,0.25); pointer-events: none;
          width: 16px; height: 16px;
        }
        .form-input {
          width: 100%; padding: 13px 14px 13px 42px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; color: #fff;
          font-size: 15px; font-family: 'DM Sans', sans-serif; font-weight: 400;
          transition: all 0.2s ease; outline: none;
        }
        .form-input::placeholder { color: rgba(255,255,255,0.2); }
        .form-input:focus {
          border-color: rgba(59,130,246,0.5);
          background: rgba(59,130,246,0.05);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        .form-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .hint { font-size: 12px; color: rgba(255,255,255,0.25); margin-top: 6px; }

        /* Submit btn */
        .submit-btn {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          border: none; border-radius: 12px; cursor: pointer;
          font-size: 15px; font-weight: 600; color: #fff;
          font-family: 'DM Sans', sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.2s ease;
          margin-top: 8px;
          box-shadow: 0 4px 20px rgba(59,130,246,0.3);
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(59,130,246,0.4);
        }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* Alerts */
        .alert {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; border-radius: 10px; margin-bottom: 20px;
          font-size: 13px; line-height: 1.5;
        }
        .alert.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; }
        .alert.success { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.2); color: #6ee7b7; }
        .alert svg { flex-shrink: 0; margin-top: 1px; width: 15px; height: 15px; }

        /* Spinning loader */
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Responsive */
        @media (max-width: 900px) {
          .left-panel { display: none; }
          .right-panel { width: 100%; padding: 24px; }
          .login-root { justify-content: center; }
        }
      `}</style>

      <div className="login-root">
        {/* Background */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="grid-overlay" />

        {/* Left panel */}
        <div className="left-panel">
          <div className="brand-badge">
            <Sparkles size={12} color="#60a5fa" />
            <span>Blackboard AI</span>
          </div>

          <h1 className="hero-title">
            Think deeper,<br />
            <span className="gradient-text">chat smarter.</span>
          </h1>

          <p className="hero-desc">
            An AI workspace that remembers context, saves tokens, and keeps your conversations flowing — securely.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon blue"><Brain size={20} /></div>
              <div className="feature-text">
                <h4>Blackboard Memory</h4>
                <p>Auto-summarizes every 5 messages, saving up to 80% tokens</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon purple"><Zap size={20} /></div>
              <div className="feature-text">
                <h4>Real-time Streaming</h4>
                <p>Instant responses with live character-by-character streaming</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon green"><Shield size={20} /></div>
              <div className="feature-text">
                <h4>Encrypted API Keys</h4>
                <p>Your OpenAI key stored with AES-256 encryption. Always.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - form */}
        <div className="right-panel">
          <div className="form-card">
            <div className="form-header">
              <h2>{activeTab === "login" ? "Welcome back" : "Create account"}</h2>
              <p>{activeTab === "login" ? "Sign in to your workspace" : "Start chatting in seconds"}</p>
            </div>

            {/* Tab switcher */}
            <div className="tab-switcher">
              <button className={`tab-btn ${activeTab === "login" ? "active" : ""}`} onClick={() => { setActiveTab("login"); clear(); }}>
                Login
              </button>
              <button className={`tab-btn ${activeTab === "signup" ? "active" : ""}`} onClick={() => { setActiveTab("signup"); clear(); }}>
                Sign Up
              </button>
            </div>

            {/* Google */}
            <button className="google-btn" onClick={handleGoogleLogin} disabled={isGoogleLoading || isLoading}>
              {isGoogleLoading ? <Loader2 size={18} className="spin" /> : (
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {isGoogleLoading ? "Redirecting..." : "Continue with Google"}
            </button>

            <div className="divider">
              <div className="divider-line" />
              <span>or</span>
              <div className="divider-line" />
            </div>

            {/* Alerts */}
            {error && (
              <div className="alert error">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="alert success">
                <CheckCircle size={15} />
                <span>{success}</span>
              </div>
            )}

            {/* Login form */}
            {activeTab === "login" && (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <div className="input-wrap">
                    <Mail className="input-icon" />
                    <input className="form-input" type="email" placeholder="you@example.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      disabled={isLoading} autoComplete="email" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="input-wrap">
                    <Lock className="input-icon" />
                    <input className="form-input" type="password" placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)}
                      disabled={isLoading} autoComplete="current-password" />
                  </div>
                </div>
                <button className="submit-btn" type="submit" disabled={isLoading || isGoogleLoading}>
                  {isLoading ? <><Loader2 size={16} className="spin" />Signing in...</> : <><LogIn size={16} />Sign In</>}
                </button>
              </form>
            )}

            {/* Signup form */}
            {activeTab === "signup" && (
              <form onSubmit={handleSignup}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <div className="input-wrap">
                    <Mail className="input-icon" />
                    <input className="form-input" type="email" placeholder="you@example.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      disabled={isLoading} autoComplete="email" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="input-wrap">
                    <Lock className="input-icon" />
                    <input className="form-input" type="password" placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)}
                      disabled={isLoading} autoComplete="new-password" />
                  </div>
                  <div className="hint">Minimum 6 characters</div>
                </div>
                <button className="submit-btn" type="submit" disabled={isLoading || isGoogleLoading}>
                  {isLoading ? <><Loader2 size={16} className="spin" />Creating account...</> : <><UserPlus size={16} />Create Account</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
