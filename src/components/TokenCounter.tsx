"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TokenCounterProps {
  initialSavings?: number;
  className?: string;
}

export default function TokenCounter({ initialSavings = 0, className }: TokenCounterProps) {
  const [totalSaved, setTotalSaved] = useState(initialSavings);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavings, setLastSavings] = useState(0);
  const [showPulse, setShowPulse] = useState(false);

  // Fetch persisted savings on mount
  useEffect(() => {
    fetch("/api/blackboard/savings")
      .then((r) => r.json())
      .then((data) => { if (data.totalSaved) setTotalSaved(data.totalSaved); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleTokenSavings = (event: CustomEvent) => {
      const tokens = event.detail?.tokens || 0;
      if (tokens > 0) {
        setLastSavings(tokens);
        setIsSaving(true);
        setTotalSaved((prev) => prev + tokens);
        setShowPulse(true);
        setTimeout(() => setIsSaving(false), 500);
        setTimeout(() => setShowPulse(false), 1000);
      }
    };
    window.addEventListener("token-savings", handleTokenSavings as EventListener);
    return () => window.removeEventListener("token-savings", handleTokenSavings as EventListener);
  }, []);

  const dollarSavings = (totalSaved / 1000) * 0.002;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toLocaleString();
  };

  return (
    <div className={cn("fixed top-4 right-4 z-50 transition-all duration-300", className)}>
      <div className={cn(
        "relative rounded-full px-4 py-2 border shadow-lg backdrop-blur-sm transition-all duration-300",
        isSaving ? "bg-emerald-500/20 border-emerald-500/50 scale-110" : "bg-black/40 border-white/10 hover:bg-black/50",
        showPulse && "ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-background"
      )}>
        <div className="flex items-center space-x-2">
          <Sparkles className={cn("h-4 w-4 transition-colors duration-300", isSaving ? "text-emerald-400" : "text-amber-400")} />
          <span className={cn("font-bold text-lg tabular-nums transition-colors duration-300", isSaving ? "text-emerald-400" : "text-white")}>
            {formatNumber(totalSaved)}
          </span>
          <span className="text-sm text-gray-300">tokens saved</span>
          {isSaving && (
            <div className="ml-2 flex items-center space-x-1">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <TrendingDown className="h-3 w-3 text-emerald-400" />
            </div>
          )}
        </div>
        {isSaving && <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md -z-10 animate-pulse" />}
      </div>
      <div className={cn("absolute -bottom-8 right-0 text-xs whitespace-nowrap transition-all duration-300", totalSaved > 0 ? "opacity-100" : "opacity-50")}>
        {totalSaved > 0 ? (
          <span className="text-emerald-400 font-medium">${dollarSavings.toFixed(3)} saved!</span>
        ) : (
          <span className="text-gray-500">Start chatting to see savings</span>
        )}
      </div>
      {lastSavings > 0 && isSaving && (
        <div className="absolute -top-8 right-0 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full animate-bounce">
          +{lastSavings.toLocaleString()} tokens!
        </div>
      )}
    </div>
  );
}

export function useTokenSavings() {
  const dispatchTokenSavings = useCallback((tokens: number) => {
    if (typeof window !== "undefined" && tokens > 0) {
      window.dispatchEvent(new CustomEvent("token-savings", { detail: { tokens } }));
    }
  }, []);
  return { dispatchTokenSavings };
}
