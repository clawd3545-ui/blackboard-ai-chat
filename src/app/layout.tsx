import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blackboard AI Chat - Secure AI Conversations",
  description: "A secure, privacy-focused chat application with conversation summarization and encrypted API key storage.",
  keywords: ["AI", "Chat", "OpenAI", "GPT", "Secure", "Encrypted", "Privacy"],
  authors: [{ name: "Blackboard AI" }],
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Blackboard AI Chat",
    description: "Secure AI conversations with context awareness",
    siteName: "Blackboard AI Chat",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
