// ============================================
// MULTI-PROVIDER ROUTING — Updated March 2026
// Based on official API docs for each provider
// ============================================

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export type ProviderId = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'groq';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  logo: string;
  color: string;
  description: string;
  keyPlaceholder: string;
  keyPrefix: string;
  docsUrl: string;
  models: ModelConfig[];
}

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  isDefault?: boolean;
  isFast?: boolean;
  isPremium?: boolean;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '🟢',
    color: '#10a37f',
    description: 'GPT-4o, GPT-4.1 — industry standard',
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: 'Fast & affordable, great for most tasks', contextWindow: 128000, isDefault: true, isFast: true },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Flagship model, vision + text', contextWindow: 128000 },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', description: 'Faster than GPT-4o mini, 1M context', contextWindow: 1000000, isFast: true },
      { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Best at coding & instruction following', contextWindow: 1000000, isPremium: true },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    logo: '🟤',
    color: '#d4713d',
    description: 'Claude — best for reasoning & long docs',
    keyPlaceholder: 'sk-ant-...',
    keyPrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      // Verified correct IDs as of March 2026
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fastest Claude, best cost-performance', contextWindow: 200000, isDefault: true, isFast: true },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Best balance of speed & intelligence', contextWindow: 200000 },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most powerful — complex reasoning', contextWindow: 200000, isPremium: true },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    logo: '🔵',
    color: '#4285f4',
    description: 'Gemini — massive context, multimodal',
    keyPlaceholder: 'AIza...',
    keyPrefix: 'AIza',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    models: [
      // Correct stable IDs as of March 2026
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Best price-performance, reasoning built-in', contextWindow: 1000000, isDefault: true, isFast: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable Gemini, deep reasoning', contextWindow: 1000000, isPremium: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen — stable & fast', contextWindow: 1000000, isFast: true },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '🐋',
    color: '#5c6bc0',
    description: 'DeepSeek — cheapest API, exceptional quality',
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: '~95% cheaper than GPT-4o, comparable quality', contextWindow: 128000, isDefault: true, isFast: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Chain-of-thought reasoning model', contextWindow: 128000, isPremium: true },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    logo: '⚡',
    color: '#f97316',
    description: 'Groq — fastest inference speed',
    keyPlaceholder: 'gsk_...',
    keyPrefix: 'gsk_',
    docsUrl: 'https://console.groq.com/keys',
    models: [
      // mixtral-8x7b-32768 REMOVED — deprecated March 2025
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Best quality, ultra-fast inference', contextWindow: 128000, isDefault: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fastest responses, high volume tasks', contextWindow: 128000, isFast: true },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout', description: 'Latest Llama 4 — vision + text', contextWindow: 128000 },
    ],
  },
];

export function getProvider(id: ProviderId): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === id);
}

export function getDefaultModel(providerId: ProviderId): string {
  const provider = getProvider(providerId);
  return provider?.models.find(m => m.isDefault)?.id || provider?.models[0]?.id || 'gpt-4o-mini';
}

// ============================================
// CREATE AI MODEL INSTANCE
// ============================================
export function createModel(providerId: ProviderId, apiKey: string, modelId: string) {
  switch (providerId) {
    case 'openai':
      return createOpenAI({ apiKey })(modelId);
    case 'anthropic':
      return createAnthropic({ apiKey })(modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case 'deepseek':
      return createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' })(modelId);
    case 'groq':
      return createOpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' })(modelId);
    default:
      return createOpenAI({ apiKey })(modelId);
  }
}

// ============================================
// API KEY VALIDATION
// ============================================
export function validateApiKey(providerId: ProviderId, key: string): { valid: boolean; error?: string } {
  if (!key?.trim() || key.trim().length < 10) return { valid: false, error: 'API key is too short' };
  switch (providerId) {
    case 'openai':
      if (!key.startsWith('sk-') && !key.startsWith('sk-proj-')) return { valid: false, error: 'OpenAI keys start with sk- or sk-proj-' };
      break;
    case 'anthropic':
      if (!key.startsWith('sk-ant-')) return { valid: false, error: 'Anthropic keys start with sk-ant-' };
      break;
    case 'google':
      if (!key.startsWith('AIza')) return { valid: false, error: 'Google API keys start with AIza' };
      break;
    case 'groq':
      if (!key.startsWith('gsk_')) return { valid: false, error: 'Groq keys start with gsk_' };
      break;
    case 'deepseek':
      if (!key.startsWith('sk-')) return { valid: false, error: 'DeepSeek keys start with sk-' };
      break;
  }
  return { valid: true };
}
