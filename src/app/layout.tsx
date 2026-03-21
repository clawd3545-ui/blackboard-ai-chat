import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Blackboard AI — Multi-Model Chat with Smart Memory",
  description: "BYOK AI chat with Blackboard memory compression. Use OpenAI, Claude, Gemini, DeepSeek, or Groq. Save 60-90% tokens automatically.",
  keywords: ["AI", "Chat", "OpenAI", "Claude", "Gemini", "DeepSeek", "Groq", "BYOK", "Token Saving"],
  authors: [{ name: "Blackboard AI" }],
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Blackboard AI",
    description: "Multi-model AI chat with automatic memory compression",
    siteName: "Blackboard AI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
