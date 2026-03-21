"use client";

import React, { useState, useEffect } from "react";
import { Key, Save, Trash2, Check, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ApiKeyData { id: string; provider: string; is_active: boolean; created_at: string; updated_at: string; }
interface SettingsProps { open: boolean; onOpenChange: (open: boolean) => void; }

export default function Settings({ open, onOpenChange }: SettingsProps) {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedKeys, setSavedKeys] = useState<ApiKeyData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { if (open) loadApiKeys(); }, [open]);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 5000); return () => clearTimeout(t); } }, [message]);

  const loadApiKeys = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/keys");
      const data = await response.json();
      if (response.ok) setSavedKeys(data.keys || []);
      else setMessage({ type: "error", text: data.error || "Failed to load API keys" });
    } catch { setMessage({ type: "error", text: "Failed to load API keys" }); }
    finally { setIsLoading(false); }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) { setMessage({ type: "error", text: "Please enter an API key" }); return; }
    if (!apiKey.startsWith("sk-")) { setMessage({ type: "error", text: "OpenAI API keys should start with 'sk-'" }); return; }
    setIsSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: apiKey.trim(), provider: "openai" }) });
      const data = await response.json();
      if (response.ok) { setMessage({ type: "success", text: "API key saved successfully!" }); setApiKey(""); await loadApiKeys(); }
      else setMessage({ type: "error", text: data.error || data.message || "Failed to save API key" });
    } catch { setMessage({ type: "error", text: "Failed to save API key" }); }
    finally { setIsSaving(false); }
  };

  const handleDeleteApiKey = async (provider: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;
    setIsDeleting(true); setMessage(null);
    try {
      const response = await fetch("/api/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
      const data = await response.json();
      if (response.ok) { setMessage({ type: "success", text: "API key deleted successfully!" }); await loadApiKeys(); }
      else setMessage({ type: "error", text: data.error || "Failed to delete API key" });
    } catch { setMessage({ type: "error", text: "Failed to delete API key" }); }
    finally { setIsDeleting(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5" />Settings</DialogTitle>
          <DialogDescription>Manage your API keys and application preferences</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="api-keys" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>
          <TabsContent value="api-keys" className="space-y-4">
            {message && (
              <div className={cn("flex items-center gap-2 p-3 rounded-md text-sm", message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200")}>
                {message.type === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {message.text}
              </div>
            )}
            <div className="space-y-4">
              <h3 className="font-medium">Add OpenAI API Key</h3>
              <p className="text-sm text-muted-foreground">Your API key is encrypted before being stored. We never store it in plain text.</p>
              <div className="space-y-2">
                <Label htmlFor="api-key">OpenAI API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input id="api-key" type={showApiKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowApiKey(!showApiKey)}>
                      {showApiKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveApiKey} disabled={isSaving || !apiKey.trim()}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Save</>}
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-medium">Saved API Keys</h3>
              {isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : savedKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><Key className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No API keys saved yet</p></div>
              ) : (
                <div className="space-y-2">
                  {savedKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-2 w-2 rounded-full", key.is_active ? "bg-green-500" : "bg-gray-400")} />
                        <div><p className="font-medium capitalize">{key.provider}</p><p className="text-xs text-muted-foreground">Added {formatDate(key.created_at)}</p></div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteApiKey(key.provider)} disabled={isDeleting} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="about" className="space-y-4">
            <h3 className="font-medium">About Blackboard AI Chat</h3>
            <p className="text-sm text-muted-foreground">A secure, privacy-focused chat application using the blackboard pattern to maintain conversation context.</p>
            <div className="pt-4 border-t"><p className="text-xs text-muted-foreground">Version 1.0.0 | Built with Next.js, Supabase, and OpenAI</p></div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
