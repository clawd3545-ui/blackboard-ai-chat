"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, User, Zap, ChevronDown } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase";
import { PROVIDERS, type ProviderId } from "@/lib/providers";

interface Message { id: string; role: "user" | "assistant" | "system"; content: string; created_at?: string; }
interface BlackboardStatus { hasSummary: boolean; messagesSummarized: number; totalTokensSaved: number; }
interface ChatInterfaceProps {
  conversationId?: string;
  onConversationCreated?: (id: string, title: string) => void;
  onNewChat?: () => void;
}

const STARTER_PROMPTS = [
  { icon: "✍️", label: "Help me write", prompt: "Help me write a professional email to my team about a project update." },
  { icon: "🧠", label: "Explain a concept", prompt: "Explain quantum computing in simple terms I can understand." },
  { icon: "💻", label: "Debug code", prompt: "Review this code and help me find and fix any bugs or issues." },
  { icon: "📊", label: "Analyze data", prompt: "Help me analyze and summarize this data with key insights." },
];

export default function ChatInterface({ conversationId, onConversationCreated, onNewChat }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId);
  const [blackboard, setBlackboard] = useState<BlackboardStatus | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("openai");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [savedProviders, setSavedProviders] = useState<string[]>([]);
  const [planInfo, setPlanInfo] = useState<{ plan: string; messagesUsed: number; monthlyLimit: number; percentUsed: number; isPro: boolean } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const supabase = createBrowserClient();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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

  useEffect(() => {
    fetch("/api/keys").then(r => r.json()).then(d => {
      if (d.keys) setSavedProviders(d.keys.map((k: any) => k.provider));
    }).catch(() => {});
    fetch("/api/user/plan").then(r => r.json()).then(d => {
      if (!d.error) setPlanInfo(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node))
        setModelPickerOpen(false);
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

  // FIX: Load blackboard status — called after every send too
  const loadBlackboardStatus = async (convId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const r = await fetch(`/api/summarize?conversationId=${convId}&userId=${session.user.id}`);
      if (r.ok) {
        const d = await r.json();
        if (d.data && (d.data.message_count > 0 || d.data.total_tokens_saved > 0)) {
          setBlackboard({
            hasSummary: !!d.data.summary,
            messagesSummarized: d.data.message_count || 0,
            totalTokensSaved: d.data.total_tokens_saved || 0,
          });
        }
      }
    } catch {}
  };

  const createConversation = async (firstMessage: string): Promise<string> => {
    const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "..." : "");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const { data, error } = await supabase.from("conversations")
      .insert({ title, model: selectedModel, provider: selectedProvider, user_id: session.user.id }).select().single();
    if (error) throw error;
    setCurrentConversationId(data.id);
    onConversationCreated?.(data.id, title);
    return data.id;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMessage = text.trim();
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setIsLoading(true);
    setMessages(prev => [...prev, { id: `temp-${Date.now()}`, role: "user", content: userMessage, created_at: new Date().toISOString() }]);

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
        if (response.status === 429 || err.error === 'limit_reached') {
          setShowUpgradeModal(true);
          setMessages(prev => prev.slice(0, -1)); // remove temp user message
          setIsLoading(false);
          return;
        }
        throw new Error(err.message || err.error || "Failed to get response");
      }

      const assistantId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", created_at: new Date().toISOString() }]);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
      }

      await loadMessages(convId);
      // Refresh plan usage
      fetch("/api/user/plan").then(r => r.json()).then(d => { if (!d.error) setPlanInfo(d); }).catch(() => {});
      // FIX: Always check blackboard after every message, not just after 5
      setIsSummarizing(true);
      setTimeout(async () => {
        await loadBlackboardStatus(convId!);
        setIsSummarizing(false);
      }, 2000);

    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      const msg = error instanceof Error ? error.message : "Something went wrong";
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: "assistant", content: `❌ ${msg}`, created_at: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider);
  const currentModelName = currentProvider?.models.find(m => m.id === selectedModel)?.name || selectedModel;

  return (
    <div className="flex flex-col h-full relative">

      {/* ALWAYS-VISIBLE BLACKBOARD STATUS BAR */}
      <div className="shrink-0 border-b border-border px-4 py-2 flex items-center gap-4 bg-muted/10">
        <div className="flex items-center gap-1.5">
          <Logo size={14} />
          <span className="text-xs font-medium text-foreground">Blackboard</span>
        </div>
        {isSummarizing ? (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Compressing history...</span>
          </div>
        ) : blackboard && blackboard.totalTokensSaved > 0 ? (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{blackboard.messagesSummarized} msgs compressed</span>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <Zap className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                ~{formatTokens(blackboard.totalTokensSaved)} tokens saved
              </span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Compresses every 5 messages · saves 60–90% tokens</span>
        )}
      </div>

      {/* UPGRADE MODAL — shown when limit reached */}
      {showUpgradeModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="max-w-sm w-full mx-4 p-6 rounded-2xl border border-border bg-card shadow-2xl text-center">
            <div className="text-4xl mb-3">🚫</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Monthly limit reached</h3>
            <p className="text-sm text-muted-foreground mb-1">
              You've used all <span className="font-medium text-foreground">{planInfo?.monthlyLimit} messages</span> on the Free plan this month.
            </p>
            <p className="text-xs text-muted-foreground mb-5">Upgrade to Pro for unlimited messages, or wait for your limit to reset next month.</p>
            <div className="flex flex-col gap-2">
              <a href="/pricing"
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                ⭐ Upgrade to Pro — $9/month
              </a>
              <button onClick={() => setShowUpgradeModal(false)}
                className="w-full py-2 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAN WARNING BAR — at 80%+ usage */}
      {planInfo && !planInfo.isPro && planInfo.percentUsed >= 80 && (
        <div className={`shrink-0 px-4 py-2 text-xs flex items-center justify-between ${
          planInfo.percentUsed >= 100
            ? "bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400"
            : "bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400"
        }`}>
          <span>
            {planInfo.percentUsed >= 100
              ? `🚫 Monthly limit reached (${planInfo.messagesUsed}/${planInfo.monthlyLimit})`
              : `⚠️ ${planInfo.messagesUsed}/${planInfo.monthlyLimit} messages used this month`
            }
          </span>
          <a href="/pricing" className="font-semibold underline underline-offset-2 hover:opacity-80">
            Upgrade →
          </a>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 pb-24">
            <div className="mb-5"><Logo size={56} /></div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">How can I help you?</h1>
            <p className="text-sm text-muted-foreground mb-8 text-center">
              <span className="font-medium text-foreground">{currentProvider?.logo} {currentModelName}</span>
              {" · "}Blackboard compresses context every 5 messages
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {STARTER_PROMPTS.map(s => (
                <button key={s.label} onClick={() => sendMessage(s.prompt)}
                  className="flex flex-col items-start gap-1.5 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors text-left group">
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-sm font-medium text-foreground">{s.label}</span>
                  <span className="text-xs text-muted-foreground line-clamp-2">{s.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.map((msg, idx) => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5 text-base">
                    {currentProvider?.logo}
                  </div>
                )}
                <div className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted/50 text-foreground rounded-bl-sm border border-border"
                )}>
                  {msg.content
                    ? <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    : isLoading && idx === messages.length - 1 && msg.role === "assistant" && (
                      <div className="flex gap-1 items-center h-5">
                        {[0, 150, 300].map(delay => (
                          <span key={delay} className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
                            style={{ animationDelay: `${delay}ms` }} />
                        ))}
                      </div>
                    )
                  }
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col rounded-2xl border border-border bg-muted/20 px-4 pt-3 pb-2 focus-within:border-ring transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${currentModelName}...`}
              rows={1}
              disabled={isLoading}
              className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed max-h-52 disabled:opacity-50"
              style={{ minHeight: "24px" }}
            />
            <div className="flex items-center justify-between mt-2">
              {/* Model switcher */}
              <div className="relative" ref={modelPickerRef}>
                <button onClick={() => setModelPickerOpen(!modelPickerOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <span className="text-base leading-none">{currentProvider?.logo}</span>
                  <span>{currentModelName}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
                {modelPickerOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-popover border border-border rounded-xl shadow-xl z-50">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground">Select model</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1.5">
                      {PROVIDERS.map(provider => (
                        <div key={provider.id}>
                          <div className="flex items-center gap-2 px-2 py-1">
                            <span className="text-sm">{provider.logo}</span>
                            <span className="text-xs font-semibold text-muted-foreground">{provider.name}</span>
                            {!savedProviders.includes(provider.id) && (
                              <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded">No key</span>
                            )}
                          </div>
                          {provider.models.map(model => (
                            <button key={model.id}
                              onClick={() => { setSelectedProvider(provider.id as ProviderId); setSelectedModel(model.id); setModelPickerOpen(false); }}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors",
                                selectedProvider === provider.id && selectedModel === model.id
                                  ? "bg-primary/10 text-primary"
                                  : "hover:bg-muted text-foreground"
                              )}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">{model.name}</span>
                                  {model.isFast && <span className="text-[10px] text-blue-500">⚡</span>}
                                  {model.isPremium && <span className="text-[10px] text-amber-500">⭐</span>}
                                </div>
                                <p className="text-muted-foreground text-[11px] truncate">{model.description}</p>
                              </div>
                              {selectedProvider === provider.id && selectedModel === model.id && (
                                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 border-t border-border bg-muted/20">
                      <p className="text-[11px] text-muted-foreground text-center">Context preserved when switching ✓</p>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading || (planInfo !== null && !planInfo.isPro && planInfo.percentUsed >= 100)}
                className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-all shrink-0",
                  input.trim() && !isLoading && !(planInfo && !planInfo.isPro && planInfo.percentUsed >= 100)
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed")}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-1.5">
            Shift+Enter for new line · Blackboard saves tokens every 5 messages
          </p>
        </div>
      </div>
    </div>
  );
}
