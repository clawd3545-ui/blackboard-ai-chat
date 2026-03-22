import Link from "next/link";
import { Check, X, Zap, Shield, Users, Sparkles, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Pricing — Blackboard AI", description: "Simple, transparent pricing. Start free, upgrade when you need more." };

const FREE_FEATURES = [
  { text: "100 messages per month", included: true },
  { text: "All 5 AI providers (OpenAI, Claude, Gemini, DeepSeek, Groq)", included: true },
  { text: "All 13 AI models", included: true },
  { text: "Blackboard memory compression", included: true },
  { text: "AES-256 encrypted API key storage", included: true },
  { text: "Conversation history", included: true },
  { text: "Model switching mid-conversation", included: true },
  { text: "Priority support", included: false },
  { text: "Unlimited messages", included: false },
];

const PRO_FEATURES = [
  { text: "Unlimited messages", included: true },
  { text: "All 5 AI providers (OpenAI, Claude, Gemini, DeepSeek, Groq)", included: true },
  { text: "All 13 AI models", included: true },
  { text: "Blackboard memory compression", included: true },
  { text: "AES-256 encrypted API key storage", included: true },
  { text: "Conversation history", included: true },
  { text: "Model switching mid-conversation", included: true },
  { text: "Priority support", included: true },
  { text: "Early access to new features", included: true },
];

const FAQS = [
  {
    q: "Do I need to pay for AI responses?",
    a: "No — you use your own API keys (BYOK). You pay your AI provider directly (OpenAI, Anthropic, etc.). Blackboard AI only charges for the platform."
  },
  {
    q: "How does Blackboard save my tokens?",
    a: "Every 5 messages, Blackboard compresses older conversation history into a dense summary. Future messages send the summary + recent messages instead of the full history — saving 60–90% of tokens on long conversations."
  },
  {
    q: "What counts as a 'message'?",
    a: "Each message you send to an AI model counts as one message. AI responses don't count."
  },
  {
    q: "Can I switch between free and pro?",
    a: "Yes, you can upgrade or downgrade at any time. Downgrading takes effect at the end of your billing period."
  },
  {
    q: "Is my API key safe?",
    a: "Yes. Keys are encrypted with AES-256-GCM using PBKDF2 key derivation. The plaintext key never touches our database and is only decrypted in memory when needed."
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity">
            <Logo size={28} />
            Blackboard AI
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
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
          You bring your own API keys — we handle the infrastructure, memory compression, and security.
        </p>
      </section>

      {/* Plans */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Free Plan */}
          <div className="flex flex-col rounded-2xl border border-border p-8 bg-muted/10">
            <div className="mb-6">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Free</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Perfect to get started. No credit card required.</p>
            </div>

            <Link href="/login"
              className="w-full py-2.5 px-4 rounded-xl border border-border text-sm font-medium text-center hover:bg-muted transition-colors mb-8">
              Start for free →
            </Link>

            <ul className="space-y-3 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f.text} className="flex items-start gap-3">
                  {f.included
                    ? <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    : <X className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                  }
                  <span className={cn("text-sm", !f.included && "text-muted-foreground/50 line-through")}>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Plan */}
          <div className="flex flex-col rounded-2xl border-2 border-primary/40 p-8 bg-primary/5 relative overflow-hidden">
            {/* Popular badge */}
            <div className="absolute top-5 right-5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                <Zap className="h-3 w-3" />Most Popular
              </span>
            </div>

            <div className="mb-6">
              <div className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Pro</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold">$9</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Unlimited messages. Priority support. No limits.</p>
            </div>

            <Link href="/login"
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium text-center hover:opacity-90 transition-opacity mb-8 flex items-center justify-center gap-2">
              Get Pro <ArrowRight className="h-4 w-4" />
            </Link>

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

        {/* Note */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          <Shield className="inline h-3.5 w-3.5 mr-1" />
          You pay your AI provider separately for API usage. Blackboard AI never charges for AI responses.
        </p>
      </section>

      {/* Why BYOK */}
      <section className="border-t border-border py-16 px-6 bg-muted/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Why Bring Your Own Key?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Full Control", desc: "Your key, your data, your costs. We never markup or resell AI credits." },
              { icon: Zap, title: "All Providers", desc: "Use OpenAI, Claude, Gemini, DeepSeek, or Groq — switch anytime without losing context." },
              { icon: Users, title: "Real Savings", desc: "Blackboard compresses long conversations 60–90%. Your API bill drops significantly." },
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
        <Link href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity">
          Get started for free <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 Blackboard AI. All rights reserved.</p>
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

// cn helper inline since this is a server component
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
