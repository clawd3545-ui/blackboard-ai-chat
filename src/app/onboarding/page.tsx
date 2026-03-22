"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Check, ArrowRight, ExternalLink, Loader2, Key } from "lucide-react";
import { PROVIDERS } from "@/lib/providers";
import { createBrowserClient } from "@/lib/supabase";
import { toast } from "sonner";

const STEPS = ["Welcome", "Add API Key", "First Chat"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login");
    });
  }, []);

  const provider = PROVIDERS.find(p => p.id === selectedProvider)!;

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), provider: selectedProvider }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast.success(`${provider.name} key saved!`);
      setSaved(true);
      setTimeout(() => setStep(2), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save key");
    } finally { setSaving(false); }
  };

  const handleSkip = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                i < step ? "bg-emerald-500 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 w-8 rounded ${i < step ? "bg-emerald-500" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="flex justify-center mb-4"><Logo size={56} /></div>
              <h1 className="text-2xl font-bold mb-2">Welcome to NexChat</h1>
              <p className="text-muted-foreground text-sm mb-6">The AI chat that saves your tokens automatically. Let's get you set up in 60 seconds.</p>
              <div className="space-y-3 text-left mb-6">
                {["Use your own API keys — we never charge for AI responses", "8 providers: OpenAI, Claude, Gemini, DeepSeek & more", "NexChat compresses context — saves 60–90% tokens"].map(f => (
                  <div key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                Get started <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={handleSkip} className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Skip for now
              </button>
            </div>
          )}

          {/* Step 1: Add API Key */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Key className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Add your API key</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-5">Your key is encrypted with AES-256 and stored securely.</p>

              {/* Provider selector */}
              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {PROVIDERS.slice(0, 8).map(p => (
                  <button key={p.id} onClick={() => setSelectedProvider(p.id)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition-all ${selectedProvider === p.id ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                    <span className="text-lg">{p.logo}</span>
                    <span className="text-[10px] font-medium truncate w-full text-center">{p.name.split(" ")[0]}</span>
                  </button>
                ))}
              </div>

              <div className="mb-2">
                <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />Get your {provider.name} API key
                </a>
              </div>

              <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password"
                placeholder={provider.keyPlaceholder}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-ring mb-4"
                onKeyDown={e => { if (e.key === "Enter") handleSaveKey(); }}
              />

              <button onClick={handleSaveKey} disabled={!apiKey.trim() || saving}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : saved ? <><Check className="h-4 w-4" />Saved!</> : <>Save key <ArrowRight className="h-4 w-4" /></>}
              </button>
              <button onClick={handleSkip} className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Skip — I'll add it later in Settings
              </button>
            </div>
          )}

          {/* Step 2: Go chat */}
          {step === 2 && (
            <div className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold mb-2">You're all set!</h2>
              <p className="text-sm text-muted-foreground mb-6">Your API key is saved. Start chatting — NexChat will automatically compress your conversations to save tokens.</p>
              <button onClick={() => router.push("/dashboard")}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                Start chatting <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Your API keys are encrypted. <a href="/privacy" className="underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
