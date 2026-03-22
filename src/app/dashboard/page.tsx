"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Settings, LogOut, MessageSquare, Trash2, Loader2,
  User, Sun, Moon, Menu, X, ChevronDown,
  Sparkles, Zap, Shield
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase";
import ChatInterface from "@/components/ChatInterface";
import SettingsDialog from "@/components/Settings";
import { Logo } from "@/components/Logo";
import { PROVIDERS, type ProviderId } from "@/lib/providers";

interface Conversation { id: string; title: string; created_at: string; updated_at: string; }
interface UserProfile { id: string; email: string; full_name: string | null; avatar_url?: string | null; }

// Format date for sidebar
function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Group conversations by date
function groupConversations(convs: Conversation[]) {
  const groups: Record<string, Conversation[]> = {};
  const now = new Date();
  convs.forEach(c => {
    const d = new Date(c.updated_at);
    const diff = now.getTime() - d.getTime();
    let label = "Older";
    if (diff < 86400000) label = "Today";
    else if (diff < 172800000) label = "Yesterday";
    else if (diff < 604800000) label = "Last 7 days";
    else if (diff < 2592000000) label = "Last 30 days";
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  });
  return groups;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const { theme, setTheme } = useTheme();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [planInfo, setPlanInfo] = useState<{ plan: string; messagesUsed: number; monthlyLimit: number; percentUsed: number; isPro: boolean } | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setUser({
        id: session.user.id,
        email: session.user.email || "",
        full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
        avatar_url: session.user.user_metadata?.avatar_url || null,
      });
      await loadConversations();
      // Load plan info
      fetch('/api/user/plan').then(r => r.json()).then(d => {
        if (!d.error) setPlanInfo(d);
      }).catch(() => {});
      setIsLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) router.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadConversations = async () => {
    const { data } = await supabase.from("conversations").select("*").order("updated_at", { ascending: false });
    setConversations(data || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleConversationCreated = useCallback((id: string, title: string) => {
    setConversations(prev => [{ id, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev]);
    setSelectedConversationId(id);
  }, []);

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    await supabase.from("conversations").delete().eq("id", id);
    setConversations(prev => prev.filter(c => c.id !== id));
    setSelectedConversationId(curr => curr === id ? undefined : curr);
    setDeletingId(null);
  };

  const userInitial = (user?.full_name?.[0] || user?.email?.[0] || "U").toUpperCase();
  const grouped = groupConversations(conversations);
  const groupOrder = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Older"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Logo size={40} />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* SIDEBAR */}
      <aside className={cn(
        "flex flex-col bg-muted/20 border-r border-border transition-all duration-200 shrink-0",
        sidebarOpen ? "w-60" : "w-0 overflow-hidden"
      )}>
        {/* Logo + toggle */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-semibold text-sm">Blackboard AI</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New Chat button */}
        <div className="px-3 py-2">
          <button
            onClick={() => setSelectedConversationId(undefined)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors text-foreground"
          >
            <Plus className="h-4 w-4 shrink-0" />
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1 px-2">
          {conversations.length === 0 ? (
            <div className="py-10 text-center">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="pb-2">
              {groupOrder.map(label => {
                const group = grouped[label];
                if (!group) return null;
                return (
                  <div key={label} className="mb-3">
                    <p className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {label}
                    </p>
                    {group.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversationId(conv.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm group transition-colors",
                          selectedConversationId === conv.id
                            ? "bg-primary/10 text-foreground"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="flex-1 truncate text-[13px]">{conv.title}</span>
                        <button
                          onClick={(e) => handleDeleteConversation(e, conv.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive shrink-0"
                        >
                          {deletingId === conv.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />
                          }
                        </button>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Bottom: user + settings */}
        <div className="border-t border-border p-2 space-y-1">
          {/* Plan badge — dynamic */}
          {planInfo && (
            <div className="mx-1 mb-1 px-3 py-2 rounded-lg bg-muted/40 border border-border">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {planInfo.isPro ? (
                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">⭐ PRO</span>
                  ) : (
                    <span className="text-xs font-medium text-foreground">Free Plan</span>
                  )}
                </div>
                {!planInfo.isPro && (
                  <a href="/pricing" className="text-[10px] font-semibold text-primary hover:underline">Upgrade →</a>
                )}
              </div>
              {!planInfo.isPro && (
                <>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{planInfo.messagesUsed} / {planInfo.monthlyLimit} messages</span>
                    <span className={planInfo.percentUsed >= 90 ? "text-red-500 font-medium" : planInfo.percentUsed >= 70 ? "text-amber-500" : ""}>{planInfo.percentUsed}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all ${planInfo.percentUsed >= 90 ? "bg-red-500" : planInfo.percentUsed >= 70 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(planInfo.percentUsed, 100)}%` }}
                    />
                  </div>
                </>
              )}
              {planInfo.isPro && (
                <p className="text-[10px] text-muted-foreground">Unlimited messages ∞</p>
              )}
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
          <div className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg">
            {user?.avatar_url
              ? <img src={user.avatar_url} className="h-7 w-7 rounded-full object-cover shrink-0" alt="" />
              : <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">{userInitial}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-foreground">{user?.full_name || user?.email?.split("@")[0]}</p>
            </div>
            <button onClick={handleLogout} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Logout">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar when sidebar closed */}
        {!sidebarOpen && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                <Logo size={14} />
              </div>
              <span className="font-semibold text-sm">Blackboard AI</span>
            </div>
            <div className="flex-1" />
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <ChatInterface
            conversationId={selectedConversationId}
            onConversationCreated={handleConversationCreated}
            onNewChat={() => setSelectedConversationId(undefined)}
          />
        </div>
      </main>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
}
