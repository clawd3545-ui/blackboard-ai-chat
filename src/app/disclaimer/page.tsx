import PublicLayout from "@/components/PublicLayout";
export const metadata = { title: "Disclaimer — Nexchat" };
export default function DisclaimerPage() {
  return (
    <PublicLayout title="Disclaimer">
      <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 mb-6">
        <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">⚠️ AI-generated content may be inaccurate. Always verify critical information independently.</p>
      </div>
      <section><h2 className="text-xl font-semibold mb-3">AI-Generated Content</h2>
        <p className="text-muted-foreground">Responses are produced by AI systems and may contain errors or outdated information. Nexchat does not verify or endorse AI-generated content.</p></section>
      <section><h2 className="text-xl font-semibold mb-3">Not Professional Advice</h2>
        <p className="text-muted-foreground">Nothing here constitutes medical, legal, financial, or professional advice. Consult qualified professionals for important decisions.</p></section>
      <section><h2 className="text-xl font-semibold mb-3">Blackboard Compression</h2>
        <p className="text-muted-foreground">The Blackboard feature summarizes older context to reduce tokens. Some details may be simplified. The status bar in your chat shows when compression has occurred.</p></section>
      <section><h2 className="text-xl font-semibold mb-3">API Costs</h2>
        <p className="text-muted-foreground">You are responsible for all charges from your AI providers. Actual token savings vary by conversation length, content, and model.</p></section>
      <section><h2 className="text-xl font-semibold mb-3">Third-Party Services</h2>
        <p className="text-muted-foreground">We are not responsible for the availability, pricing, or content of third-party AI providers.</p></section>
    </PublicLayout>
  );
}
