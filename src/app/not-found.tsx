import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <Logo size={48} />
      <h1 className="text-6xl font-bold text-foreground mt-6 mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-8">This page doesn't exist.</p>
      <Link href="/" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
        Go home
      </Link>
    </div>
  );
}
