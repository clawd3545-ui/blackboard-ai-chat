"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, User, Bot, Brain, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase";
import { PROVIDERS, type ProviderId } from "@/lib/providers";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
  tokens_used?: number;
}

interface BlackboardStatus {
  hasSummary: boolean;
  messagesSummarized: number;
  totalTokensSaved: number;
}

interface ChatInterfaceProps {
  conversationId?: string;
  onConversationCreated?: (id: string, title: string) => void;
}

export default function ChatInterface({ conversationId, onConversationCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId);
  const [blackboard, setBlackboard] = useState<BlackboardStatus | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Model selector state
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("openai");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [savedProviders, setSavedProviders] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const supabase = createBrowserClient();
  const modelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (conversationId) {
      setCurrentConversationId(conversationId);
      loadMessages(conversationId);
      loadBlackboardStatus(conversationId);
    } else {
      setMessages([]);
      setCurrentConversationId(undefined);
      setBlackboard(null);
    }
  }, [conversationId]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Load which providers the user has keys for
  useEffect(() => {
    fetch("/api/keys").then(r => r.json()).then(d => {
      if (d.keys) setSavedProviders(d.keys.map((k: any) => k.provider));
    }).catch(() => {});
  }, []);

  // Close model picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadMessages = async (convId: string) => {
    try {
      const r = await fetch(`/api/chat?conversationId=${convId}`);
      const d = await r.json();
      setMessages((d.messages || []).filter((m: Message) => m.role !== "system"));
    } catch {}
  };

  const loadBlackboardStatus = async (convId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const r = await fetch(`/api/summarize?conversationId=${convId}&userId=${session.user.id}`);
      if (r.ok) {
        const d = await r.json();
        if (d.data) setBlackboard({ hasSummary: true, messagesSummarized: d.data.message_count || 0, totalTokensSaved: d.data.total_tokens_saved || 0 });
      }
    } catch {}
  };

  const createConversation = async (firstMessage: string): Promise<string> => {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
    const { data, error } = await supabase.from("conversations").insert({ title, model: selectedModel, provider: selectedProvider }).select().single();
    if (error) throw error;
    setCurrentConversationId(data.id);
    onConversationCreated?.(data.id, title);
    return data.id;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    const tempMsg: Message = { id: `temp-${Date.now()}`, role: "user", content: userMessage, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);

    try {
      let convId = currentConversationId;
      if (!convId) convId = await createConversation(userMessage);

      abortRef.current = new AbortController();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, conversationId: convId, model: selectedModel, provider: selectedProvider }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to get response");
      }

      const assistantId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", created_at: new Date().toISOString() }]);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // toTextStreamResponse sends raw text (no prefix)
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
      }

      // Reload and check blackboard
      await loadMessages(convId);
      setIsSummarizing(true);
      setTimeout(async () => { await loadBlackboardStatus(convId!); setIsSummarizing(false); }, 3000);

    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      const errMsg = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: "assistant", content: `❌ ${errMsg}`, created_at: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider);
  const currentModelName = currentProvider?.models.find(m => m.id === selectedModel)?.name || selectedModel;

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Top bar: Blackboard status + Model picker */}
      <div className="flex items-center justify-between px-4 py-2 border-b gap-3">
        {/* Blackboard status */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <span className="font-medium text-foreground">Blackboard</span>
          </div>
          {isSummarizing ? (
            <div className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
              <span className="text-amber-600">Summarizing...</span>
            </div>
          ) : blackboard?.hasSummary ? (
            <div className="flex items-center gap-2">
              <span>{blackboard.messagesSummarized} msgs compressed</span>
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600 font-medium">~{formatTokens(blackboard.totalTokensSaved)} saved</span>
              </div>
            </div>
          ) : (
            <span>Compresses every 5 messages</span>
          )}
        </div>

        {/* Model picker */}
        <div className="relative flex-shrink-0" ref={modelPickerRef}>
          <button
            onClick={() => setModelPickerOpen(!modelPickerOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
          >
            <span>{currentProvider?.logo}</span>
            <span className="max-w-[120px] truncate">{currentModelName}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {modelPickerOpen && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-2 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Choose model</p>
              </div>
              <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                {PROVIDERS.map(provider => (
                  <div key={provider.id}>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <span className="text-base">{provider.logo}</span>
                      <span className="text-xs font-semibold text-muted-foreground">{provider.name}</span>
                      {!savedProviders.includes(provider.id) && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded ml-auto">No key</span>
                      )}
                    </div>
                    {provider.models.map(model => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedProvider(provider.id as ProviderId);
                          setSelectedModel(model.id);
                          setModelPickerOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors",
                          selectedProvider === provider.id && selectedModel === model.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium truncate">{model.name}</span>
                            {model.isDefault && <span className="text-[10px] text-muted-foreground">(default)</span>}
                            {model.isFast && <span className="text-[10px] text-blue-500">⚡</span>}
                            {model.isPremium && <span className="text-[10px] text-amber-500">⭐</span>}
                          </div>
                          <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{model.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-border">
                <p className="text-[11px] text-muted-foreground text-center px-2">
                  Context is preserved when switching models ✓
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef as any}>
        <div className="max-w-3xl mx-auto py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <div className="text-5xl mb-4">{currentProvider?.logo}</div>
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">{currentModelName} · Blackboard compression every 5 messages</p>
            </div>
          ) : (
            messages.map((message, idx) => (
              <div key={message.id} className={cn(
                "flex gap-3 p-4 rounded-lg",
                message.role === "user" ? "bg-muted/40" : "bg-background border"
              )}>
                <div className="flex-shrink-0">
                  {message.role === "user" ? (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-lg">
                      {message.content.startsWith("❌") ? "❌" : currentProvider?.logo || <Bot className="h-4 w-4" />}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {message.role === "user" ? "You" : currentModelName}
                  </p>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                    {isLoading && idx === messages.length - 1 && message.role === "assistant" && !message.content && (
                      <span className="animate-pulse">▊</span>
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-background p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder={`Message ${currentModelName}...`}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Switch models anytime · context stays intact · Blackboard saves your tokens
        </p>
      </div>
    </div>
  );
}
