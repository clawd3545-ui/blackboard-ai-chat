import PublicLayout from "@/components/PublicLayout";
export const metadata = { title: "Privacy Policy — NexChat" };
export default function PrivacyPage() {
  return (
    <PublicLayout title="Privacy Policy">
      <section><h2 className="text-xl font-semibold mb-3">1. What We Collect</h2>
        <p className="text-muted-foreground leading-relaxed">We collect only what's necessary:</p>
        <ul className="mt-3 space-y-2 text-muted-foreground list-disc pl-5">
          <li><strong className="text-foreground">Account info:</strong> Email and optionally your name, collected at signup.</li>
          <li><strong className="text-foreground">Conversations:</strong> Messages stored to enable history. Only you can access them.</li>
          <li><strong className="text-foreground">API keys:</strong> Encrypted with AES-256-GCM + PBKDF2. Never stored in plaintext.</li>
          <li><strong className="text-foreground">Usage metadata:</strong> Token counts for savings stats only. No content analysis.</li>
        </ul>
      </section>
      <section><h2 className="text-xl font-semibold mb-3">2. How We Use Your Data</h2>
        <ul className="space-y-2 text-muted-foreground list-disc pl-5">
          <li>Providing the NexChat service and conversation memory</li>
          <li>Authenticating your session securely</li>
          <li>Showing token savings statistics</li>
        </ul>
        <p className="mt-3 text-muted-foreground">We do <strong className="text-foreground">not</strong> sell your data, use it for ads, or share with third parties beyond service providers (Supabase, Vercel).</p>
      </section>
      <section><h2 className="text-xl font-semibold mb-3">3. API Key Security</h2>
        <p className="text-muted-foreground leading-relaxed">Keys are encrypted with AES-256-GCM using PBKDF2-SHA256 (600,000 iterations) and a unique random salt per key. The encryption secret never leaves our servers. API calls go directly to your AI provider using your key — we do not log API call content.</p>
      </section>
      <section><h2 className="text-xl font-semibold mb-3">4. Data Retention</h2>
        <p className="text-muted-foreground">Conversations are stored while your account is active. Delete any conversation anytime. To delete your account and all data, email privacy@nexchat.in.</p>
      </section>
      <section><h2 className="text-xl font-semibold mb-3">5. Your Rights</h2>
        <ul className="space-y-2 text-muted-foreground list-disc pl-5">
          <li>Access, export, or delete your personal data</li>
          <li>Remove API keys anytime via Settings</li>
          <li>Request account deletion within 7 days</li>
        </ul>
      </section>
      <section><h2 className="text-xl font-semibold mb-3">6. Contact</h2>
        <p className="text-muted-foreground">Privacy concerns: <a href="mailto:privacy@nexchat.in" className="text-primary hover:underline">privacy@nexchat.in</a></p>
      </section>
    </PublicLayout>
  );
}
