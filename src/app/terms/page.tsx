import PublicLayout from "@/components/PublicLayout";
export const metadata = { title: "Terms of Service — Blackboard AI" };
export default function TermsPage() {
  return (
    <PublicLayout title="Terms of Service">
      <section><h2 className="text-xl font-semibold mb-3">1. Acceptance</h2>
        <p className="text-muted-foreground">By using Blackboard AI, you agree to these Terms. If you disagree, please do not use the service.</p></section>
      <section><h2 className="text-xl font-semibold mb-3">2. Service Description</h2>
        <p className="text-muted-foreground">Blackboard AI is a Bring-Your-Own-Key (BYOK) AI chat platform supporting OpenAI, Anthropic, Google, DeepSeek, and Groq, with automatic context compression to save tokens.</p></section>
      <section><h2 className="text-xl font-semibold mb-3">3. Your Responsibilities</h2>
        <ul className="space-y-2 text-muted-foreground list-disc pl-5">
          <li>Maintain security of your account credentials</li>
          <li>All API costs from your keys are your responsibility</li>
          <li>No illegal, harmful, or abusive content</li>
          <li>Comply with your AI provider's terms of service</li>
        </ul>
      </section>
      <section><h2 className="text-xl font-semibold mb-3">4. API Keys</h2>
        <p className="text-muted-foreground">You provide your own API keys stored encrypted. We are not responsible for charges incurred on your provider accounts.</p></section>
      <section><h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
        <p className="text-muted-foreground">You retain rights to your content. Blackboard AI retains rights to the platform and Blackboard compression technology.</p></section>
      <section><h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
        <p className="text-muted-foreground">Blackboard AI is provided "as is." We are not liable for indirect, incidental, or consequential damages including API costs, data loss, or service interruptions.</p></section>
      <section><h2 className="text-xl font-semibold mb-3">7. Contact</h2>
        <p className="text-muted-foreground"><a href="mailto:legal@blackboard-ai.com" className="text-primary hover:underline">legal@blackboard-ai.com</a></p></section>
    </PublicLayout>
  );
}
