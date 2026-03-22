"use client";
import { toast } from "sonner";

import React, { useState, useEffect } from "react";
import { Key, Trash2, Check, AlertCircle, Loader2, Eye, EyeOff, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PROVIDERS, type ProviderId } from "@/lib/providers";

interface SavedKey { id: string; provider: string; is_active: boolean; created_at: string; }
interface SettingsProps { open: boolean; onOpenChange: (open: boolean) => void; }

export default function Settings({ open, onOpenChange }: SettingsProps) {
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ openai: true });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string; provider?: string } | null>(null);

  useEffect(() => { if (open) loadKeys(); }, [open]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t); } }, [msg]);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/keys");
      const d = await r.json();
      if (r.ok) setSavedKeys(d.keys || []);
    } catch {}
    finally { setLoading(false); }
  };

  const hasKey = (provider: string) => savedKeys.some(k => k.provider === provider);
  const keyDate = (provider: string) => {
    const k = savedKeys.find(k => k.provider === provider);
    return k ? new Date(k.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  };

  const handleSave = async (providerId: string) => {
    const key = inputs[providerId]?.trim();
    if (!key) { setMsg({ type: "err", text: "Enter your API key", provider: providerId }); return; }
    setSaving(providerId);
    try {
      const r = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, provider: providerId }),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg({ type: "ok", text: "API key saved!", provider: providerId });
        setInputs(prev => ({ ...prev, [providerId]: "" }));
        await loadKeys();
      } else {
        setMsg({ type: "err", text: d.error || "Failed to save", provider: providerId });
      }
    } catch { setMsg({ type: "err", text: "Network error", provider: providerId }); }
    finally { setSaving(null); }
  };

  const handleDelete = async (providerId: string) => {
    if (!confirm(`Remove your ${PROVIDERS.find(p=>p.id===providerId)?.name} API key?`)) return;
    setDeleting(providerId);
    try {
      const r = await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      if (r.ok) {
        setMsg({ type: "ok", text: "Key removed", provider: providerId });
        await loadKeys();
      }
    } catch {}
    finally { setDeleting(null); }
  };

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" /> API Keys
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2 mb-4">
          Add your own API keys. All keys are encrypted with AES-256 and never shared.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {PROVIDERS.map(provider => {
              const connected = hasKey(provider.id);
              const date = keyDate(provider.id);
              const isExpanded = expanded[provider.id];
              const isSavingThis = saving === provider.id;
              const isDeletingThis = deleting === provider.id;
              const providerMsg = msg?.provider === provider.id ? msg : null;

              return (
                <div
                  key={provider.id}
                  className={cn(
                    "border rounded-xl overflow-hidden transition-all",
                    connected ? "border-green-200 bg-green-50/30 dark:border-green-900 dark:bg-green-950/20" : "border-border"
                  )}
                >
                  {/* Header row */}
                  <button
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => toggle(provider.id)}
                  >
                    <span className="text-2xl">{provider.logo}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{provider.name}</span>
                        {connected && (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                            <Check className="h-3 w-3" /> Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
                      {connected && date && (
                        <p className="text-xs text-muted-foreground mt-0.5">Added {date}</p>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                      {/* Available models */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Available models</p>
                        <div className="flex flex-wrap gap-1.5">
                          {provider.models.map(m => (
                            <span key={m.id} className={cn(
                              "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border",
                              m.isDefault ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted border-border text-muted-foreground"
                            )}>
                              {m.isFast && "⚡"}{m.isPremium && "⭐"} {m.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Provider message */}
                      {providerMsg && (
                        <div className={cn(
                          "flex items-center gap-2 p-2.5 rounded-lg text-xs",
                          providerMsg.type === "ok"
                            ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                            : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                        )}>
                          {providerMsg.type === "ok" ? <Check className="h-3.5 w-3.5 flex-shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />}
                          {providerMsg.text}
                        </div>
                      )}

                      {/* Input + save */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={show[provider.id] ? "text" : "password"}
                            placeholder={connected ? "Enter new key to replace..." : provider.keyPlaceholder}
                            value={inputs[provider.id] || ""}
                            onChange={e => setInputs(prev => ({ ...prev, [provider.id]: e.target.value }))}
                            className="pr-9 text-sm font-mono"
                            onKeyDown={e => e.key === "Enter" && handleSave(provider.id)}
                          />
                          <button
                            type="button"
                            onClick={() => setShow(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {show[provider.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSave(provider.id)}
                          disabled={isSavingThis || !inputs[provider.id]?.trim()}
                          className="flex-shrink-0"
                        >
                          {isSavingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : connected ? "Update" : "Save"}
                        </Button>
                        {connected && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(provider.id)}
                            disabled={isDeletingThis}
                            className="flex-shrink-0 text-destructive hover:text-destructive"
                          >
                            {isDeletingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>

                      {/* Get key link */}
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> Get your {provider.name} API key →
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
