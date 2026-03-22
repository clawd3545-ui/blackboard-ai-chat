"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";

// ============================================
// TOKEN SAVINGS BADGE
// Step 5: Show real savings to user
// Fetches from blackboard table on mount + updates live
// ============================================

interface TokenCounterProps {
  conversationId?: string;
  className?: string;
}

export default function TokenCounter({ conversationId, className }: TokenCounterProps) {
  const [totalSaved, setTotalSaved] = useState(0);
  const [percentSaved, setPercentSaved] = useState(0);
  const [pulse, setPulse] = useState(false);
  const supabase = createBrowserClient();

  // Fetch savings on mount and when conversation changes
  useEffect(() => {
    fetchSavings();
  }, [conversationId]);

  // Listen for summarization events (fired after each summary)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { tokensSaved, percent } = e.detail || {};
      if (tokensSaved > 0) {
        setTotalSaved(prev => prev + tokensSaved);
        if (percent) setPercentSaved(percent);
        setPulse(true);
        setTimeout(() => setPulse(false), 2000);
      }
    };
    window.addEventListener('blackboard:saved', handler as EventListener);
    return () => window.removeEventListener('blackboard:saved', handler as EventListener);
  }, []);

  const fetchSavings = async () => {
    try {
      const res = await fetch('/api/blackboard/savings');
      if (res.ok) {
        const { totalSaved: ts } = await res.json();
        if (ts > totalSaved) setTotalSaved(ts);
      }
    } catch {}
  };

  if (totalSaved === 0) return null;

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  };

  // Rough cost savings: GPT-4o-mini input ~$0.15/1M tokens
  const dollarSaved = ((totalSaved / 1_000_000) * 0.15).toFixed(4);

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        background: pulse ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.08)',
        border: `1px solid ${pulse ? 'rgba(52,211,153,0.4)' : 'rgba(52,211,153,0.2)'}`,
        borderRadius: '100px',
        fontSize: '12px',
        color: '#34d399',
        fontWeight: 500,
        transition: 'all 0.3s ease',
        cursor: 'default',
        userSelect: 'none',
      }}
      title={`NexChat has saved ~$${dollarSaved} in API costs this session`}
    >
      <span style={{ fontSize: '10px' }}>⚡</span>
      <span>{formatNumber(totalSaved)} tokens saved</span>
      {percentSaved > 0 && (
        <span style={{ opacity: 0.7, fontSize: '11px' }}>({percentSaved}%)</span>
      )}
    </div>
  );
}

// Hook to dispatch savings events from other components
export function useTokenSavings() {
  const dispatch = useCallback((tokensSaved: number, percent?: number) => {
    if (typeof window === 'undefined' || tokensSaved <= 0) return;
    window.dispatchEvent(new CustomEvent('blackboard:saved', {
      detail: { tokensSaved, percent }
    }));
  }, []);
  return { dispatch };
}
