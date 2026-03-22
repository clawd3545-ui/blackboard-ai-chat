"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Settings, LogOut, MessageSquare, Trash2, Loader2,
  User, Sun, Moon, Menu, X, Search, Pencil, Download
} from "lucide-react";
import { useTheme } from "next-themes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase";
import ChatInterface from "@/components/ChatInterface";
import SettingsDialog from "@/components/Settings";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

interface Conversation { id: string; title: string; created_at: string; updated_at: string; }
interface UserProfile { id: string; email: string; full_name: string | null; avatar_url?: string | null; }
interface PlanInfo { plan: string; messagesUsed: number; monthlyLimit: number; percentUsed: number; isPro: boolean; }

function groupConversations(convs: Conversation[]) {
  const groups: Record<string, Conversation[]> = {};
  const now = new Date();
  convs.forEach(c => {
    const diff = now.getTime() - new Date(c.updated_at).getTime();
    const label = diff < 86400000 ? "Today" : diff < 172800000 ? "Yesterday" : diff < 604800000 ? "Last 7 days" : diff < 2592000000 ? "Last 30 days" : "Older";
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  });
  return groups;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const { theme, setTheme } = useTheme();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  // On mobile, sidebar closed by default
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (searchParams.get("upgraded") === "1") {
      toast.success("⭐ Welcome to Pro! Unlimited messages activated.");
    }

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setUser({
        id: session.user.id,
        email: session.user.email || "",
        full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
        avatar_url: session.user.user_metadata?.avatar_url || null,
      });
      const [convsResult] = await Promise.all([
        supabase.from("conversations").select("*").order("updated_at", { ascending: false }),
        fetch("/api/user/plan").then(r => r.json()).then(d => { if (!d.error) setPlanInfo(d); }).catch(() => {}),
      ]);
      setConversations(convsResult.data || []);
      setIsLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) router.replace("/login");
    });

    // Listen for open-settings event from ChatInterface banner
    const openSettingsHandler = () => setIsSettingsOpen(true);
    window.addEventListener('open-settings', openSettingsHandler);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('open-settings', openSettingsHandler);
    };
  }, []);

  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus();
  }, [renamingId]);

  const handleConversationCreated = useCallback((id: string, title: string) => {
    setConversations(prev => [{ id, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev]);
    setSelectedConversationId(id);
  }, []);

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); }
    else {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (selectedConversationId === id) setSelectedConversationId(undefined);
      toast.success("Conversation deleted");
    }
    setDeletingId(null);
  };

  const startRename = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  };

  const submitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    const { error } = await supabase.from("conversations").update({ title: trimmed }).eq("id", id);
    if (error) { toast.error("Failed to rename"); }
    else {
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: trimmed } : c));
      toast.success("Renamed");
    }
    setRenamingId(null);
  };

  const handleExportConversation = async () => {
    if (!selectedConversationId) return;
    try {
      const r = await fetch(`/api/chat?conversationId=${selectedConversationId}`);
      const d = await r.json();
      const messages = (d.messages || []).filter((m: any) => m.role !== "system");
      const conv = conversations.find(c => c.id === selectedConversationId);
      let md = `# ${conv?.title || "Conversation"}\n\nExported from NexChat — ${new Date().toLocaleDateString()}\n\n---\n\n`;
      messages.forEach((m: any) => {
        md += `**${m.role === "user" ? "You" : "AI"}**\n\n${m.content}\n\n---\n\n`;
      });
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${conv?.title?.slice(0, 30) || "conversation"}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported as Markdown");
    } catch { toast.error("Export failed"); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const filtered = searchQuery.trim()
    ? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;
  const grouped = groupConversations(filtered);
  const groupOrder = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Older"];
  const userInitial = (user?.full_name?.[0] || user?.email?.[0] || "U").toUpperCase();

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <Logo size={40} className="animate-pulse" />
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={cn(
        "flex flex-col bg-muted/20 border-r border-border shrink-0 transition-all duration-200",
        "fixed md:relative z-30 h-full",
        sidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:w-0 md:overflow-hidden md:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Logo size={26} />
            <span className="font-semibold text-sm">NexChat</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New Chat */}
        <div className="px-3 py-2">
          <button onClick={() => { setSelectedConversationId(undefined); if (window.innerWidth < 768) setSidebarOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <Plus className="h-4 w-4 shrink-0" />New Chat
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats..." className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground" />
            {searchQuery && <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>}
          </div>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1 px-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-xs text-muted-foreground">{searchQuery ? "No results" : "No conversations yet"}</p>
            </div>
          ) : (
            <div className="pb-2">
              {groupOrder.map(label => {
                const group = grouped[label];
                if (!group) return null;
                return (
                  <div key={label} className="mb-3">
                    <p className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                    {group.map(conv => (
                      <div key={conv.id}
                        onClick={() => handleSelectConversation(conv.id)}
                        className={cn("w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm group transition-colors cursor-pointer",
                          selectedConversationId === conv.id ? "bg-primary/10 text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        {renamingId === conv.id ? (
                          <input ref={renameRef} value={renameValue} onChange={e => setRenameValue(e.target.value)}
                            onBlur={() => submitRename(conv.id)}
                            onKeyDown={e => { if (e.key === "Enter") submitRename(conv.id); if (e.key === "Escape") setRenamingId(null); }}
                            onClick={e => e.stopPropagation()}
                            className="flex-1 bg-background border border-primary rounded px-1.5 py-0.5 text-xs text-foreground outline-none" />
                        ) : (
                          <span className="flex-1 truncate text-[13px]">{conv.title}</span>
                        )}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                          <button onClick={e => startRename(e, conv)} className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground" title="Rename">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={e => handleDeleteConversation(e, conv.id)} className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-red-500" title="Delete">
                            {deletingId === conv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Bottom */}
        <div className="border-t border-border p-2 space-y-1">
          {planInfo && (
            <div className="mx-1 mb-1 px-3 py-2 rounded-lg bg-muted/40 border border-border">
              <div className="flex items-center justify-between mb-1">
                {planInfo.isPro
                  ? <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">⭐ PRO</span>
                  : <span className="text-xs font-medium">Free Plan</span>
                }
                {!planInfo.isPro && <a href="/pricing" className="text-[10px] font-semibold text-primary hover:underline">Upgrade →</a>}
              </div>
              {planInfo.isPro
                ? <p className="text-[10px] text-muted-foreground">Unlimited messages ∞</p>
                : <>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{planInfo.messagesUsed}/{planInfo.monthlyLimit} msgs</span>
                    <span className={planInfo.percentUsed >= 90 ? "text-red-500" : planInfo.percentUsed >= 70 ? "text-amber-500" : ""}>{planInfo.percentUsed}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${planInfo.percentUsed >= 90 ? "bg-red-500" : planInfo.percentUsed >= 70 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(planInfo.percentUsed, 100)}%` }} />
                  </div>
                </>
              }
            </div>
          )}
          <button onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="h-4 w-4 shrink-0" />API Keys
          </button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
            {user?.avatar_url
              ? <img src={user.avatar_url} className="h-7 w-7 rounded-full object-cover shrink-0" alt="" />
              : <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">{userInitial}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.full_name || user?.email?.split("@")[0]}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Logout">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Open sidebar">
            <Menu className="h-4 w-4" />
          </button>
          {selectedConversationId && (
            <p className="text-sm font-medium text-foreground truncate flex-1">
              {conversations.find(c => c.id === selectedConversationId)?.title || "Chat"}
            </p>
          )}
          <div className="flex-1" />
          {selectedConversationId && (
            <button onClick={handleExportConversation} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Export conversation">
              <Download className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <ChatInterface conversationId={selectedConversationId} onConversationCreated={handleConversationCreated} />
        </div>
      </main>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
}
