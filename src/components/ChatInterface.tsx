"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, User, Bot, MoreVertical, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn, formatRelativeTime } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase";
import TokenCounter from "./TokenCounter";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

interface ChatInterfaceProps {
  conversationId?: string;
  onConversationCreated?: (id: string, title: string) => void;
  onConversationDeleted?: (id: string) => void;
}

export default function ChatInterface({ conversationId, onConversationCreated, onConversationDeleted }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (conversationId) { setCurrentConversationId(conversationId); loadMessages(conversationId); }
    else { setMessages([]); setCurrentConversationId(undefined); }
  }, [conversationId]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { return () => { abortControllerRef.current?.abort(); }; }, []);

  const loadMessages = async (convId: string) => {
    try {
      const response = await fetch(`/api/chat?conversationId=${convId}`);
      if (!response.ok) throw new Error("Failed to load messages");
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) { console.error("Error loading messages:", error); }
  };

  const createConversation = async (firstMessage: string): Promise<string> => {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
    const { data, error } = await supabase.from("conversations").insert({ title, model: "gpt-4o-mini" }).select().single();
    if (error) throw error;
    setCurrentConversationId(data.id);
    onConversationCreated?.(data.id, title);
    return data.id;
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || isStreaming) return;
    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    const tempUserMessage: Message = { id: `temp-${Date.now()}`, role: "user", content: userMessage, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, tempUserMessage]);
    try {
      let convId = currentConversationId;
      if (!convId) convId = await createConversation(userMessage);
      await streamResponse(userMessage, convId);
    } catch (error) {
      const errMsg: Message = { id: `error-${Date.now()}`, role: "assistant", content: error instanceof Error ? error.message : "Failed to send. Please try again.", created_at: new Date().toISOString() };
      setMessages((prev) => [...prev, errMsg]);
    } finally { setIsLoading(false); setIsStreaming(false); }
  };

  const streamResponse = async (message: string, convId: string) => {
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId: convId, model: "gpt-4o-mini" }),
        signal: abortControllerRef.current.signal,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Failed to get response");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      const assistantMessageId = `assistant-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantMessageId, role: "assistant", content: "", created_at: new Date().toISOString() }]);
      const decoder = new TextDecoder();
      let fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (line.startsWith("0:")) {
            try {
              const content = JSON.parse(line.slice(2));
              if (typeof content === "string") {
                fullContent += content;
                setMessages((prev) => prev.map((msg) => msg.id === assistantMessageId ? { ...msg, content: fullContent } : msg));
              }
            } catch {}
          }
        }
      }
      await loadMessages(convId);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      throw error;
    } finally { setIsStreaming(false); abortControllerRef.current = null; }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.from("messages").delete().eq("id", messageId);
      if (error) throw error;
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (error) { console.error("Error deleting message:", error); }
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editContent.trim()) return;
    try {
      const { error } = await supabase.from("messages").update({ content: editContent.trim() }).eq("id", editingMessageId);
      if (error) throw error;
      setMessages((prev) => prev.map((msg) => msg.id === editingMessageId ? { ...msg, content: editContent.trim() } : msg));
      setEditingMessageId(null); setEditContent("");
    } catch (error) { console.error("Error updating message:", error); }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <TokenCounter />
      <ScrollArea className="flex-1 px-4" ref={scrollRef as any}>
        <div className="max-w-3xl mx-auto py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">Type a message below to begin chatting</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div key={message.id} className={cn("group flex gap-3 p-4 rounded-lg", message.role === "user" ? "bg-muted/50" : "bg-background border")}>
                <div className="flex-shrink-0">
                  {message.role === "user" ? (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center"><User className="h-4 w-4 text-primary-foreground" /></div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center"><Bot className="h-4 w-4 text-secondary-foreground" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{message.role === "user" ? "You" : "Assistant"}</span>
                    {message.created_at && <span className="text-xs text-muted-foreground">{formatRelativeTime(message.created_at)}</span>}
                  </div>
                  {editingMessageId === message.id ? (
                    <div className="space-y-2">
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full min-h-[100px] p-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={!editContent.trim()}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingMessageId(null); setEditContent(""); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap break-words">
                        {message.content || (isStreaming && index === messages.length - 1 && message.role === "assistant" ? <span className="animate-pulse">▊</span> : null)}
                      </p>
                    </div>
                  )}
                </div>
                {editingMessageId !== message.id && message.role === "user" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditingMessageId(message.id); setEditContent(message.content); }}><Edit3 className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteMessage(message.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <div className="border-t bg-background p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type your message..." disabled={isLoading || isStreaming} className="flex-1" />
            <Button onClick={handleSendMessage} disabled={!input.trim() || isLoading || isStreaming}>
              {isLoading || isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Press Enter to send, Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
