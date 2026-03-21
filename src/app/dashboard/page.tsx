"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Menu, Plus, Settings, LogOut, MessageSquare, Trash2, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatRelativeTime } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase";
import ChatInterface from "@/components/ChatInterface";
import SettingsDialog from "@/components/Settings";

interface Conversation { id: string; title: string; created_at: string; updated_at: string; }
interface UserProfile { id: string; email: string; full_name: string | null; }

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => { checkAuth(); loadConversations(); }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { router.push("/login"); return; }
      setUser({ id: session.user.id, email: session.user.email || "", full_name: session.user.user_metadata?.full_name || null });
    } catch { router.push("/login"); }
    finally { setIsLoading(false); }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/login", { method: "DELETE" });
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) { console.error("Logout error:", error); }
  };

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase.from("conversations").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      setConversations(data || []);
    } catch (error) { console.error("Error loading conversations:", error); }
  };

  const handleConversationCreated = useCallback((id: string, title: string) => {
    const newConv: Conversation = { id, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setConversations((prev) => [newConv, ...prev]);
    setSelectedConversationId(id);
  }, []);

  const handleConversationDeleted = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setSelectedConversationId((current) => current === id ? undefined : current);
  }, []);

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
      if (error) throw error;
      handleConversationDeleted(conversationId);
    } catch (error) { console.error("Error deleting conversation:", error); }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className={cn("flex flex-col border-r bg-muted/30 transition-all duration-300", isSidebarOpen ? "w-64" : "w-0 overflow-hidden")}>
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="font-semibold text-lg truncate">Blackboard AI</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="shrink-0"><Menu className="h-4 w-4" /></Button>
        </div>
        <div className="p-4">
          <Button onClick={() => setSelectedConversationId(undefined)} className="w-full" variant="outline">
            <Plus className="h-4 w-4 mr-2" />New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No conversations yet</p></div>
            ) : (
              conversations.map((conversation) => (
                <button key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)}
                  className={cn("w-full flex items-center justify-between p-3 rounded-md text-left transition-colors group", selectedConversationId === conversation.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{conversation.title}</p>
                    <p className={cn("text-xs", selectedConversationId === conversation.id ? "text-primary-foreground/70" : "text-muted-foreground")}>{formatRelativeTime(conversation.updated_at)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={(e) => handleDeleteConversation(e, conversation.id)}
                    className={cn("opacity-0 group-hover:opacity-100 transition-opacity shrink-0", selectedConversationId === conversation.id ? "hover:bg-primary-foreground/20" : "")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t space-y-2">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0"><User className="h-4 w-4 text-primary-foreground" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || user?.email}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start" onClick={() => setIsSettingsOpen(true)}><Settings className="h-4 w-4 mr-2" />Settings</Button>
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Logout</Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        {!isSidebarOpen && (
          <div className="flex items-center gap-2 p-4 border-b">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}><Menu className="h-4 w-4" /></Button>
            <h1 className="font-semibold">Blackboard AI Chat</h1>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <ChatInterface conversationId={selectedConversationId} onConversationCreated={handleConversationCreated} onConversationDeleted={handleConversationDeleted} />
        </div>
      </main>
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
}
