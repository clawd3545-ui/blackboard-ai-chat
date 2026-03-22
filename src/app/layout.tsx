import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Nexchat — Multi-Model AI Chat with Smart Memory",
  description: "BYOK AI chat with smart memory compression. Use OpenAI, Claude, Gemini, DeepSeek, Groq, Qwen, MiniMax, Mistral. Save 60-90% tokens automatically.",
  keywords: ["AI", "Chat", "OpenAI", "Claude", "Gemini", "DeepSeek", "Groq", "Qwen", "BYOK", "Token Saving", "Nexchat"],
  authors: [{ name: "Nexchat" }],
  robots: "index, follow",
  metadataBase: new URL("https://nexchat.in"),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Nexchat — Multi-Model AI Chat with Smart Memory",
    description: "BYOK AI chat — use your own API keys for 8 providers. Saves 60-90% tokens automatically.",
    siteName: "Nexchat",
    url: "https://nexchat.in",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexchat",
    description: "BYOK AI chat with smart memory compression",
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
