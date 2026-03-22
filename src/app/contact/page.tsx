import PublicLayout from "@/components/PublicLayout";
import { Mail, MessageSquare, Shield, Zap } from "lucide-react";
export const metadata = { title: "Contact — NexChat" };
export default function ContactPage() {
  const contacts = [
    { Icon: Mail, label: "General", email: "hello@nexchat.in", desc: "Questions, feedback, partnerships" },
    { Icon: Shield, label: "Privacy & Security", email: "privacy@nexchat.in", desc: "Data requests, security issues" },
    { Icon: Zap, label: "Support", email: "support@nexchat.in", desc: "Technical issues, bugs, account help" },
    { Icon: MessageSquare, label: "Legal", email: "legal@nexchat.in", desc: "Terms, legal notices, compliance" },
  ];
  const faqs = [
    { q: "Are my API keys safe?", a: "Yes. Keys are encrypted with AES-256-GCM and PBKDF2 (600k iterations). The plaintext key never touches our database." },
    { q: "How much can I save with NexChat?", a: "Typically 60–90% on long conversations. Savings depend on conversation length and model." },
    { q: "Can I switch models mid-conversation?", a: "Yes. The NexChat memory summary is provider-agnostic — switch between GPT, Claude, Gemini etc. without losing context." },
    { q: "How do I delete my account?", a: "Email privacy@nexchat.in and we'll delete all your data within 7 days." },
  ];
  return (
    <PublicLayout title="Contact Us">
      <p className="text-muted-foreground text-base leading-relaxed mb-8">Bug report, feature request, or feedback — we'd love to hear from you.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
        {contacts.map(({ Icon, label, email, desc }) => (
          <a key={email} href={`mailto:${email}`} className="flex flex-col gap-1.5 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all group">
            <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><span className="font-medium text-foreground text-sm">{label}</span></div>
            <p className="text-xs text-muted-foreground">{desc}</p>
            <p className="text-xs text-primary group-hover:underline">{email}</p>
          </a>
        ))}
      </div>
      <section><h2 className="text-xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          {faqs.map(({ q, a }) => (
            <div key={q} className="border-b border-border pb-4 last:border-0">
              <p className="font-medium text-foreground text-sm mb-1">{q}</p>
              <p className="text-muted-foreground text-sm">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
