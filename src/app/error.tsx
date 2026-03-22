"use client";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <Logo size={48} />
      <h1 className="text-3xl font-bold text-foreground mt-6 mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">{error.message || "An unexpected error occurred."}</p>
      <button onClick={reset} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
        Try again
      </button>
    </div>
  );
}
