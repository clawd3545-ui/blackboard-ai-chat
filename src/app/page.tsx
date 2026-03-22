import Link from "next/link";
import { Zap, Shield, ChevronRight, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Logo size={28} />
            NexChat
          </div>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Login</Link>
            <Link href="/login" className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-6"><Logo size={64} /></div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 max-w-2xl">
          AI Chat that saves<br className="hidden sm:block" /> your tokens automatically
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed">
          Bring your own API keys for OpenAI, Claude, Gemini, DeepSeek, or Groq. NexChat compresses context every 5 messages — saving 60–90% tokens on long conversations.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mb-16">
          <Link href="/login" className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity">
            Start for free <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/pricing" className="px-6 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            See pricing
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
          {[
            { icon: null, title: "Smart Memory", desc: "Auto-compresses every 5 messages. 60–90% fewer tokens on long chats." },
            { icon: Zap, title: "5 AI Providers", desc: "OpenAI, Claude, Gemini, DeepSeek, Groq. Switch anytime without losing context." },
            { icon: Shield, title: "Your Keys, Encrypted", desc: "AES-256-GCM encryption. Your keys never touch our database in plaintext." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-5 rounded-xl border border-border bg-muted/20 text-left">
              {Icon ? <Icon className="h-5 w-5 text-primary mb-3" /> : <Logo size={20} className="mb-3" />}
              <p className="font-semibold text-sm mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 NexChat. All rights reserved.</p>
          <div className="flex items-center gap-4">
            {["/pricing", "/privacy", "/terms", "/disclaimer", "/contact"].map(href => (
              <Link key={href} href={href} className="hover:text-foreground transition-colors capitalize">{href.slice(1)}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
