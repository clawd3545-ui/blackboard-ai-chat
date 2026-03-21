"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, UserPlus, LogIn, AlertCircle, CheckCircle, Sparkles } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

// Animated canvas background
function CosmicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const nodes: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    for (let i = 0; i < 55; i++) {
      nodes.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 2 + 1 });
    }

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.35;
            const pulse = Math.sin(frame * 0.02 + i * 0.3) * 0.15 + 0.2;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(139, 92, 246, ${alpha * pulse})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach((n, i) => {
        const pulse = Math.sin(frame * 0.03 + i * 0.5) * 0.5 + 0.5;
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3);
        grd.addColorStop(0, `rgba(167, 139, 250, ${0.9 * pulse})`);
        grd.addColorStop(1, "rgba(167, 139, 250, 0)");
        ctx.beginPath();
        ctx.fillStyle = grd;
        ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = `rgba(220, 200, 255, ${0.95 * pulse})`;
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();

        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });

      requestAnimationFrame(animate);
    };
    animate();
    return () => window.removeEventListener("resize", resize);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const nextPath = searchParams.get("redirectTo") || "/dashboard";

  useEffect(() => {
    setMounted(true);
    const urlError = searchParams.get("error");
    if (urlError) setError(decodeURIComponent(urlError));
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) router.replace(nextPath); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) router.replace(nextPath);
    });
    return () => subscription.unsubscribe();
  }, []);

  const clear = () => { setError(null); setSuccess(null); };

  const handleGoogle = async () => {
    clear(); setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clear();
    if (!email.trim()) { setError("Email is required"); return; }
    if (!password) { setError("Password is required"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (error.message.includes("Invalid login credentials")) setError("Wrong email or password.");
        else if (error.message.includes("Email not confirmed")) setError("Please confirm your email first.");
        else setError(error.message);
        return;
      }
      router.replace(nextPath);
    } catch { setError("Something went wrong. Try again."); }
    finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); clear();
    if (!email.trim()) { setError("Email is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${SITE_URL}/auth/callback` } });
      if (error) { setError(error.message); return; }
      if (data.session) { router.replace(nextPath); return; }
      if (data.user && !data.user.identities?.length) { setError("Account exists. Please log in."); setTab("login"); return; }
      setSuccess("Account created! Check your email to confirm, then log in."); setEmail(""); setPassword("");
      setTimeout(() => setTab("login"), 4000);
    } catch { setError("Something went wrong. Try again."); }
    finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060612; }
        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          background: #060612;
          overflow: hidden;
        }
        /* LEFT PANEL */
        .left-panel {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px;
          overflow: hidden;
          background: radial-gradient(ellipse 80% 60% at 30% 50%, rgba(109,40,217,0.18) 0%, transparent 70%),
                      radial-gradient(ellipse 60% 40% at 70% 80%, rgba(59,130,246,0.1) 0%, transparent 60%),
                      #060612;
        }
        .left-panel::after {
          content: '';
          position: absolute;
          right: 0; top: 0; bottom: 0;
          width: 1px;
          background: linear-gradient(to bottom, transparent, rgba(139,92,246,0.4) 30%, rgba(139,92,246,0.4) 70%, transparent);
        }
        .brand-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.25);
          border-radius: 100px;
          padding: 6px 14px;
          margin-bottom: 32px;
          width: fit-content;
          opacity: 0;
          transform: translateY(16px);
          animation: fadeUp 0.6s ease 0.1s forwards;
        }
        .brand-tag span { font-size: 12px; color: rgba(167,139,250,0.9); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; }
        .brand-dot { width: 6px; height: 6px; border-radius: 50%; background: #a78bfa; box-shadow: 0 0 8px #a78bfa; animation: pulse-dot 2s ease infinite; }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.8)} }
        .left-heading {
          font-family: 'Syne', sans-serif;
          font-size: clamp(36px, 4vw, 56px);
          font-weight: 800;
          line-height: 1.05;
          color: #f8f4ff;
          margin-bottom: 20px;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeUp 0.7s ease 0.2s forwards;
        }
        .left-heading .accent {
          background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .left-sub {
          font-size: 16px;
          color: rgba(180,170,210,0.7);
          line-height: 1.7;
          max-width: 400px;
          margin-bottom: 48px;
          font-weight: 300;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeUp 0.7s ease 0.3s forwards;
        }
        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeUp 0.7s ease 0.4s forwards;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: rgba(200,190,230,0.75);
        }
        .feature-icon {
          width: 32px; height: 32px;
          border-radius: 8px;
          background: rgba(139,92,246,0.15);
          border: 1px solid rgba(139,92,246,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px;
          flex-shrink: 0;
        }
        @keyframes fadeUp { to { opacity:1; transform:translateY(0); } }

        /* RIGHT PANEL */
        .right-panel {
          width: 480px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 48px;
          background: rgba(12,10,25,0.95);
          position: relative;
          overflow-y: auto;
        }
        .form-container {
          width: 100%;
          max-width: 360px;
          opacity: 0;
          transform: translateX(20px);
          animation: fadeLeft 0.7s ease 0.3s forwards;
        }
        @keyframes fadeLeft { to { opacity:1; transform:translateX(0); } }
        .form-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 36px;
        }
        .logo-icon {
          width: 38px; height: 38px;
          background: linear-gradient(135deg, #7c3aed, #2563eb);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          box-shadow: 0 0 20px rgba(124,58,237,0.4);
        }
        .logo-text {
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #f0ecff;
          letter-spacing: -0.02em;
        }
        .form-title {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #f0ecff;
          margin-bottom: 6px;
          letter-spacing: -0.02em;
        }
        .form-sub {
          font-size: 14px;
          color: rgba(160,150,190,0.6);
          margin-bottom: 28px;
          font-weight: 300;
        }
        /* Tabs */
        .tabs {
          display: flex;
          gap: 0;
          background: rgba(255,255,255,0.04);
          border-radius: 10px;
          padding: 4px;
          margin-bottom: 24px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .tab-btn {
          flex: 1;
          padding: 9px;
          border: none;
          background: transparent;
          border-radius: 7px;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          color: rgba(160,150,190,0.5);
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.01em;
        }
        .tab-btn.active {
          background: rgba(139,92,246,0.2);
          color: #c4b5fd;
          box-shadow: 0 0 12px rgba(139,92,246,0.15) inset;
        }
        /* Google btn */
        .google-btn {
          width: 100%;
          padding: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: rgba(230,225,255,0.85);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: all 0.2s;
          margin-bottom: 20px;
          font-family: 'DM Sans', sans-serif;
        }
        .google-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.18); transform: translateY(-1px); }
        .google-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        /* Divider */
        .divider { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .divider-text { font-size: 12px; color: rgba(140,130,170,0.4); text-transform: uppercase; letter-spacing: 0.1em; }
        /* Input */
        .input-group { margin-bottom: 14px; }
        .input-label { display: block; font-size: 12.5px; font-weight: 500; color: rgba(190,180,220,0.6); margin-bottom: 6px; letter-spacing: 0.02em; text-transform: uppercase; }
        .input-wrap { position: relative; }
        .input-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: rgba(139,92,246,0.5); width: 16px; height: 16px; pointer-events: none; }
        .input-field {
          width: 100%;
          padding: 11px 14px 11px 38px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          color: #e8e4ff;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: all 0.2s;
        }
        .input-field::placeholder { color: rgba(140,130,170,0.3); }
        .input-field:focus { border-color: rgba(139,92,246,0.5); background: rgba(139,92,246,0.06); box-shadow: 0 0 0 3px rgba(139,92,246,0.08); }
        /* Submit btn */
        .submit-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
          border: none;
          border-radius: 10px;
          color: white;
          font-size: 14.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.2s;
          margin-top: 18px;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.01em;
          box-shadow: 0 4px 20px rgba(124,58,237,0.35);
        }
        .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(124,58,237,0.45); filter: brightness(1.05); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        /* Alert */
        .alert {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 11px 13px;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 16px;
        }
        .alert.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; }
        .alert.success { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.2); color: #6ee7b7; }
        .alert svg { flex-shrink: 0; margin-top: 1px; }
        /* Responsive */
        @media (max-width: 820px) {
          .left-panel { display: none; }
          .right-panel { width: 100%; }
        }
      `}</style>

      <div className="login-root">
        {/* LEFT */}
        <div className="left-panel">
          <CosmicCanvas />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="brand-tag">
              <div className="brand-dot" />
              <span>AI-Powered Chat</span>
            </div>
            <h1 className="left-heading">
              Think deeper.<br />
              Chat <span className="accent">smarter.</span>
            </h1>
            <p className="left-sub">
              Blackboard remembers your conversations intelligently — summarizing context so every chat feels seamless, no matter how long.
            </p>
            <div className="feature-list">
              {[
                { icon: "🔒", text: "End-to-end encrypted API keys — we never see yours" },
                { icon: "🧠", text: "Smart context summarization saves tokens automatically" },
                { icon: "⚡", text: "Real-time streaming with GPT-4o-mini" },
                { icon: "🔑", text: "Bring your own OpenAI key — full control" },
              ].map((f, i) => (
                <div className="feature-item" key={i} style={{ animationDelay: `${0.5 + i * 0.08}s` }}>
                  <div className="feature-icon">{f.icon}</div>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="right-panel">
          <div className="form-container">
            <div className="form-logo">
              <div className="logo-icon">◈</div>
              <span className="logo-text">Blackboard AI</span>
            </div>

            <h2 className="form-title">{tab === "login" ? "Welcome back" : "Get started"}</h2>
            <p className="form-sub">{tab === "login" ? "Sign in to your workspace" : "Create your free account"}</p>

            {/* Tabs */}
            <div className="tabs">
              <button className={`tab-btn ${tab === "login" ? "active" : ""}`} onClick={() => { setTab("login"); clear(); }}>Login</button>
              <button className={`tab-btn ${tab === "signup" ? "active" : ""}`} onClick={() => { setTab("signup"); clear(); }}>Sign Up</button>
            </div>

            {/* Google */}
            <button className="google-btn" onClick={handleGoogle} disabled={googleLoading || loading}>
              {googleLoading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : (
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {googleLoading ? "Redirecting..." : "Continue with Google"}
            </button>

            <div className="divider">
              <div className="divider-line" /><span className="divider-text">or</span><div className="divider-line" />
            </div>

            {error && <div className="alert error"><AlertCircle size={15} />{error}</div>}
            {success && <div className="alert success"><CheckCircle size={15} />{success}</div>}

            <form onSubmit={tab === "login" ? handleLogin : handleSignup}>
              <div className="input-group">
                <label className="input-label">Email</label>
                <div className="input-wrap">
                  <Mail size={15} className="input-icon" />
                  <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} autoComplete="email" />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-wrap">
                  <Lock size={15} className="input-icon" />
                  <input className="input-field" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} autoComplete={tab === "login" ? "current-password" : "new-password"} />
                </div>
                {tab === "signup" && <p style={{ fontSize: "12px", color: "rgba(140,130,170,0.4)", marginTop: "5px" }}>Minimum 6 characters</p>}
              </div>
              <button className="submit-btn" type="submit" disabled={loading || googleLoading}>
                {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : tab === "login" ? <><LogIn size={15} />Sign In</> : <><Sparkles size={15} />Create Account</>}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: "12px", color: "rgba(120,110,155,0.4)", marginTop: "28px", lineHeight: 1.6 }}>
              By continuing you agree to our terms of service
            </p>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
