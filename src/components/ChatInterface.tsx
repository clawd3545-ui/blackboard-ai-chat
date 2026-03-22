"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, User, Zap, ChevronDown, Copy, Check, RotateCcw, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message { id: string; role: "user" | "assistant" | "system"; content: string; created_at?: string; }
interface BlackboardStatus { hasSummary: boolean; messagesSummarized: number; totalTokensSaved: number; }
interface PlanInfo { plan: string; messagesUsed: number; monthlyLimit: number; percentUsed: number; isPro: boolean; }
interface ChatInterfaceProps {
  conversationId?: string;
  onConversationCreated?: (id: string, title: string) => void;
}

const STARTER_PROMPTS = [
  { icon: "✍️", label: "Write something", prompt: "Help me write a professional email to my team about a project update." },
  { icon: "🧠", label: "Explain a concept", prompt: "Explain quantum computing in simple terms I can understand." },
  { icon: "💻", label: "Debug code", prompt: "Review my code and help me find bugs or performance issues." },
  { icon: "📊", label: "Analyze data", prompt: "Help me analyze this data and give me key insights." },
];

// Markdown message renderer
function MessageContent({ content, role }: { content: string; role: string }) {
  if (role === "user") return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{content}</p>;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed
      prose-p:my-1.5 prose-p:leading-relaxed
      prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
      prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-muted/80 prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto prose-pre:my-2
      prose-pre:code:bg-transparent prose-pre:code:p-0 prose-pre:code:text-xs
      prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
      prose-blockquote:border-l-2 prose-blockquote:border-primary/40 prose-blockquote:pl-3 prose-blockquote:my-2 prose-blockquote:text-muted-foreground
      prose-table:text-xs prose-th:bg-muted/50 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1
      prose-strong:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// Copy button with check animation
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Copy">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function ChatInterface({ conversationId, onConversationCreated }: ChatInterfaceProps) {
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
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
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
    Promise.all([
      fetch("/api/keys").then(r => r.json()).then(d => { if (d.keys) setSavedProviders(d.keys.map((k: any) => k.provider)); }).catch(() => {}),
      fetch("/api/user/plan").then(r => r.json()).then(d => { if (!d.error) setPlanInfo(d); }).catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) setModelPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: Escape = stop generation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isLoading) { abortRef.current?.abort(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isLoading]);

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
        if (d.data && (d.data.message_count > 0 || d.data.total_tokens_saved > 0)) {
          setBlackboard({ hasSummary: !!d.data.summary, messagesSummarized: d.data.message_count || 0, totalTokensSaved: d.data.total_tokens_saved || 0 });
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

  const sendMessage = useCallback(async (text: string, isRegenerate = false) => {
    if (!text.trim() || isLoading) return;
    if (planInfo && !planInfo.isPro && planInfo.percentUsed >= 100) { setShowUpgradeModal(true); return; }

    const userMessage = text.trim();
    if (!isRegenerate) {
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      setMessages(prev => [...prev, { id: `temp-${Date.now()}`, role: "user", content: userMessage, created_at: new Date().toISOString() }]);
    }
    setIsLoading(true);

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
        if (response.status === 429 || err.error === "limit_reached") { setShowUpgradeModal(true); if (!isRegenerate) setMessages(prev => prev.slice(0, -1)); return; }
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
      fetch("/api/user/plan").then(r => r.json()).then(d => { if (!d.error) setPlanInfo(d); }).catch(() => {});
      setIsSummarizing(true);
      setTimeout(async () => { await loadBlackboardStatus(convId!); setIsSummarizing(false); }, 2000);

    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") { setMessages(prev => prev.filter(m => m.content !== "")); return; }
      const msg = error instanceof Error ? error.message : "Something went wrong";
      toast.error(msg);
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: "assistant", content: `❌ ${msg}` }]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isLoading, currentConversationId, selectedModel, selectedProvider, planInfo]);

  const handleRegenerate = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (!lastUserMsg) return;
    setMessages(prev => { const idx = prev.map(m => m.id).lastIndexOf(lastUserMsg.id); return prev.slice(0, idx + 1); });
    sendMessage(lastUserMsg.content, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  const stopGeneration = () => { abortRef.current?.abort(); };
  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider);
  const currentModelName = currentProvider?.models.find(m => m.id === selectedModel)?.name || selectedModel;
  const isAtLimit = planInfo && !planInfo.isPro && planInfo.percentUsed >= 100;

  return (
    <div className="flex flex-col h-full relative">

      {/* UPGRADE MODAL */}
      {showUpgradeModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="max-w-sm w-full mx-4 p-6 rounded-2xl border border-border bg-card shadow-2xl text-center">
            <div className="text-4xl mb-3">🚫</div>
            <h3 className="text-lg font-semibold mb-2">Monthly limit reached</h3>
            <p className="text-sm text-muted-foreground mb-1">You've used all <span className="font-medium text-foreground">{planInfo?.monthlyLimit} messages</span> this month.</p>
            <p className="text-xs text-muted-foreground mb-5">Upgrade to Pro for unlimited messages.</p>
            <div className="flex flex-col gap-2">
              <a href="/pricing" className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">⭐ Upgrade to Pro — ₹9/month</a>
              <button onClick={() => setShowUpgradeModal(false)} className="w-full py-2 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">Maybe later</button>
            </div>
          </div>
        </div>
      )}

      {/* BLACKBOARD STATUS BAR */}
      <div className="shrink-0 border-b border-border px-4 py-1.5 flex items-center gap-3 bg-muted/10 min-h-[36px]">
        <div className="flex items-center gap-1.5"><Logo size={14} /><span className="text-xs font-medium">Blackboard</span></div>
        {isSummarizing ? (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"><Loader2 className="h-3 w-3 animate-spin" /><span>Compressing...</span></div>
        ) : blackboard && blackboard.totalTokensSaved > 0 ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{blackboard.messagesSummarized} msgs compressed</span>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <Zap className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">~{formatTokens(blackboard.totalTokensSaved)} tokens saved</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground hidden sm:block">Compresses every 5 messages · saves 60–90% tokens</span>
        )}
      </div>

      {/* PLAN WARNING BAR */}
      {planInfo && !planInfo.isPro && planInfo.percentUsed >= 80 && (
        <div className={`shrink-0 px-4 py-1.5 text-xs flex items-center justify-between ${planInfo.percentUsed >= 100 ? "bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400" : "bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400"}`}>
          <span>{planInfo.percentUsed >= 100 ? `🚫 Limit reached (${planInfo.messagesUsed}/${planInfo.monthlyLimit})` : `⚠️ ${planInfo.messagesUsed}/${planInfo.monthlyLimit} messages used`}</span>
          <a href="/pricing" className="font-semibold underline underline-offset-2">Upgrade →</a>
        </div>
      )}

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 pb-16">
            <div className="mb-5"><Logo size={56} /></div>
            <h1 className="text-2xl font-semibold mb-2">How can I help you?</h1>
            <p className="text-sm text-muted-foreground mb-8 text-center">
              <span className="font-medium text-foreground">{currentProvider?.logo} {currentModelName}</span>
              {" · "}Blackboard compresses context every 5 messages
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {STARTER_PROMPTS.map(s => (
                <button key={s.label} onClick={() => sendMessage(s.prompt)}
                  className="flex flex-col items-start gap-1.5 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors text-left">
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground line-clamp-1">{s.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-5">
            {messages.map((msg, idx) => (
              <div key={msg.id} className={cn("flex gap-2 sm:gap-3 group", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5 text-sm">{currentProvider?.logo}</div>
                )}
                <div className={cn(
                  "max-w-[85%] sm:max-w-[78%] rounded-2xl px-3 sm:px-4 py-2.5 relative",
                  msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted/50 text-foreground rounded-bl-sm border border-border"
                )}>
                  {msg.content
                    ? <MessageContent content={msg.content} role={msg.role} />
                    : isLoading && idx === messages.length - 1 && msg.role === "assistant" && (
                      <div className="flex gap-1 items-center h-5">
                        {[0, 150, 300].map(d => <span key={d} className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                      </div>
                    )
                  }
                  {/* Message actions */}
                  {msg.content && (
                    <div className={cn("absolute top-1 flex items-center gap-0.5", msg.role === "user" ? "-left-10" : "-right-10")}>
                      <CopyButton text={msg.content} />
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {/* Regenerate button - below last message */}
            {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
              <div className="flex justify-center">
                <button onClick={handleRegenerate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors">
                  <RotateCcw className="h-3 w-3" />Regenerate
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* INPUT */}
      <div className="shrink-0 border-t border-border bg-background px-3 sm:px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col rounded-2xl border border-border bg-muted/20 px-3 sm:px-4 pt-3 pb-2 focus-within:border-ring transition-all">
            <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
              placeholder={isAtLimit ? "Upgrade to Pro to continue chatting..." : `Message ${currentModelName}...`}
              rows={1} disabled={isLoading || !!isAtLimit}
              className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed max-h-52 disabled:opacity-50"
              style={{ minHeight: "24px" }} />
            <div className="flex items-center justify-between mt-2">
              {/* Model switcher */}
              <div className="relative" ref={modelPickerRef}>
                <button onClick={() => setModelPickerOpen(!modelPickerOpen)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors max-w-[160px] sm:max-w-none truncate">
                  <span className="text-base leading-none shrink-0">{currentProvider?.logo}</span>
                  <span className="truncate">{currentModelName}</span>
                  <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                </button>
                {modelPickerOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-popover border border-border rounded-xl shadow-xl z-50">
                    <div className="px-3 py-2 border-b border-border"><p className="text-xs font-semibold text-muted-foreground">Select model</p></div>
                    <div className="max-h-60 overflow-y-auto p-1.5">
                      {PROVIDERS.map(provider => (
                        <div key={provider.id}>
                          <div className="flex items-center gap-2 px-2 py-1">
                            <span className="text-sm">{provider.logo}</span>
                            <span className="text-xs font-semibold text-muted-foreground">{provider.name}</span>
                            {!savedProviders.includes(provider.id) && <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded">No key</span>}
                          </div>
                          {provider.models.map(model => (
                            <button key={model.id}
                              onClick={() => { setSelectedProvider(provider.id as ProviderId); setSelectedModel(model.id); setModelPickerOpen(false); }}
                              className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors", selectedProvider === provider.id && selectedModel === model.id ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground")}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">{model.name}</span>
                                  {model.isFast && <span className="text-[10px] text-blue-500">⚡</span>}
                                  {model.isPremium && <span className="text-[10px] text-amber-500">⭐</span>}
                                </div>
                                <p className="text-muted-foreground text-[11px] truncate">{model.description}</p>
                              </div>
                              {selectedProvider === provider.id && selectedModel === model.id && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 border-t border-border bg-muted/20"><p className="text-[11px] text-muted-foreground text-center">Context preserved when switching ✓</p></div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {isLoading && (
                  <button onClick={stopGeneration} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors" title="Stop (Esc)">
                    <Square className="h-3 w-3" /><span className="hidden sm:inline">Stop</span>
                  </button>
                )}
                <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading || !!isAtLimit}
                  className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-all shrink-0",
                    input.trim() && !isLoading && !isAtLimit ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed")}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-1.5 hidden sm:block">
            Enter to send · Shift+Enter for new line · Esc to stop
          </p>
        </div>
      </div>
    </div>
  );
}
