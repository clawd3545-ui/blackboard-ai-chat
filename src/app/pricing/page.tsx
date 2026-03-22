"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, Zap, Shield, Users, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

const FREE_FEATURES = [
  { text: "100 messages per month", included: true },
  { text: "All 8 AI providers (OpenAI, Claude, Gemini, DeepSeek, Groq, Qwen, MiniMax, Mistral)", included: true },
  { text: "All 25 AI models", included: true },
  { text: "Smart Memory compression", included: true },
  { text: "AES-256 encrypted API key storage", included: true },
  { text: "Conversation history", included: true },
  { text: "Unlimited messages", included: false },
  { text: "Priority support", included: false },
];

const PRO_FEATURES = [
  { text: "Unlimited messages", included: true },
  { text: "All 8 AI providers + all 25 models", included: true },
  { text: "Smart Memory compression", included: true },
  { text: "AES-256 encrypted API key storage", included: true },
  { text: "Conversation history", included: true },
  { text: "Priority support", included: true },
  { text: "Early access to new features", included: true },
];

const FAQS = [
  { q: "Do I need to pay for AI responses?", a: "No — you use your own API keys (BYOK). You pay your AI provider directly. Nexchat only charges for the platform." },
  { q: "How does Blackboard save my tokens?", a: "Every 5 messages, Nexchat compresses older history into a dense summary — saving 60–90% of tokens on long conversations." },
  { q: "What payment methods are accepted?", a: "Credit/debit cards (Visa, Mastercard), UPI, NetBanking, and all major Indian wallets via Razorpay." },
  { q: "Is this a one-time payment or subscription?", a: "Monthly subscription at ₹9/month. Cancel anytime." },
  { q: "Is my API key safe?", a: "Yes. Keys are encrypted with AES-256-GCM. The plaintext never touches our database." },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      // Create order
      const res = await fetch('/api/payment/create-order', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) { window.location.href = '/login?redirectTo=/pricing'; return; }
        if (data.error === 'Already on Pro plan') { window.location.href = '/dashboard'; return; }
        throw new Error(data.error || 'Failed to create order');
      }

      // Load Razorpay checkout script
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load payment gateway'));
          document.head.appendChild(script);
        });
      }

      // Open Razorpay checkout
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'Nexchat',
        description: 'Pro Plan — Monthly',
        order_id: data.orderId,
        prefill: { email: data.prefill?.email || '' },
        theme: { color: '#0d1117' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          // Verify payment
          const verifyRes = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData.success) {
            window.location.href = '/dashboard?upgraded=1';
          } else {
            setError('Payment verification failed. Contact support if amount was deducted.');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        setError(`Payment failed: ${resp.error?.description || 'Unknown error'}`);
        setLoading(false);
      });
      rzp.open();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity">
            <Logo size={28} />
            Nexchat
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">Contact</Link>
            <Link href="/login" className="px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center py-16 px-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary font-medium mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          Simple, transparent pricing
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Start free.<br />Scale when ready.
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Bring your own API keys — we handle the infrastructure, memory compression, and security.
        </p>
      </section>

      {/* Plans */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border border-border p-8 bg-muted/10">
            <div className="mb-6">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Free</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold">₹0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Get started, no card needed.</p>
            </div>
            <Link href="/login" className="w-full py-2.5 px-4 rounded-xl border border-border text-sm font-medium text-center hover:bg-muted transition-colors mb-8">
              Start for free →
            </Link>
            <ul className="space-y-3 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f.text} className="flex items-start gap-3">
                  {f.included
                    ? <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    : <X className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                  }
                  <span className={`text-sm ${!f.included && "text-muted-foreground/50 line-through"}`}>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="flex flex-col rounded-2xl border-2 border-primary/40 p-8 bg-primary/5 relative overflow-hidden">
            <div className="absolute top-5 right-5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                <Zap className="h-3 w-3" /> Most Popular
              </span>
            </div>
            <div className="mb-6">
              <div className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Pro</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold">₹9</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Unlimited messages. Priority support.</p>
            </div>

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium text-center hover:opacity-90 transition-opacity mb-8 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Opening payment...</>
              ) : (
                <>Get Pro — ₹9/month <ArrowRight className="h-4 w-4" /></>
              )}
            </button>

            <ul className="space-y-3 flex-1">
              {PRO_FEATURES.map(f => (
                <li key={f.text} className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-sm">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          <Shield className="inline h-3.5 w-3.5 mr-1" />
          Payments secured by Razorpay · UPI · Cards · NetBanking · Wallets accepted
        </div>
      </section>

      {/* Why BYOK */}
      <section className="border-t border-border py-16 px-6 bg-muted/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Why Bring Your Own Key?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Full Control", desc: "Your key, your data, your costs. We never markup or resell AI credits." },
              { icon: Zap, title: "All Providers", desc: "OpenAI, Claude, Gemini, DeepSeek, Groq, Qwen, MiniMax, Mistral — switch anytime." },
              { icon: Users, title: "Real Savings", desc: "Nexchat compresses long conversations 60–90%. Your API bill drops significantly." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 rounded-xl border border-border bg-background">
                <Icon className="h-5 w-5 text-primary mb-3" />
                <p className="font-semibold text-sm mb-1">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="border-b border-border pb-6 last:border-0">
                <p className="font-semibold text-foreground mb-2">{q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-16 px-6 text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to start saving tokens?</h2>
        <p className="text-muted-foreground mb-6">Add your API key and start chatting in 60 seconds.</p>
        <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity">
          Get started for free <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t border-border py-6 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 Nexchat. All rights reserved.</p>
          <div className="flex items-center gap-4">
            {["/privacy", "/terms", "/disclaimer", "/contact"].map(href => (
              <Link key={href} href={href} className="hover:text-foreground transition-colors capitalize">{href.slice(1)}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
