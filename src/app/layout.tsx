import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "NexChat — Multi-Model AI Chat with Smart Memory",
  description: "BYOK AI chat with smart memory compression. Use OpenAI, Claude, Gemini, DeepSeek, Groq, Qwen, MiniMax, Mistral. Save 60–90% tokens automatically.",
  keywords: ["AI", "Chat", "NexChat", "OpenAI", "Claude", "Gemini", "DeepSeek", "Groq", "Qwen", "BYOK", "Token Saving", "AI Chat"],
  authors: [{ name: "NexChat" }],
  robots: "index, follow",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://nexchat.in"),
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "NexChat — Multi-Model AI Chat with Smart Memory",
    description: "BYOK AI chat — use your own API keys for 8 AI providers. Saves 60–90% tokens automatically with smart memory compression.",
    siteName: "NexChat",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://nexchat.in",
  },
  twitter: {
    card: "summary_large_image",
    title: "NexChat — Multi-Model AI Chat",
    description: "BYOK AI chat with smart memory compression. 8 providers, 25 models.",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.svg",
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
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
