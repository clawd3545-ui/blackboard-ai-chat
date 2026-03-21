// ============================================
// MULTI-PROVIDER ROUTING
// Supported: OpenAI, Anthropic, Google, DeepSeek, Groq
// DeepSeek + Groq use OpenAI-compatible API
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

// ============================================
// PROVIDER DEFINITIONS
// ============================================
export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '🟢',
    color: '#10a37f',
    description: 'GPT-4o, GPT-4o mini — industry standard',
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: 'Fast & cheap, great for most tasks', contextWindow: 128000, isDefault: true, isFast: true },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable GPT model', contextWindow: 128000, isPremium: true },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', description: 'Latest efficient model', contextWindow: 1000000, isFast: true },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    logo: '🟤',
    color: '#d4713d',
    description: 'Claude — best for long docs & reasoning',
    keyPlaceholder: 'sk-ant-...',
    keyPrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fastest Claude, great value', contextWindow: 200000, isDefault: true, isFast: true },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Best balance of speed & quality', contextWindow: 200000 },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most powerful Claude', contextWindow: 200000, isPremium: true },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    logo: '🔵',
    color: '#4285f4',
    description: 'Gemini — massive context window',
    keyPlaceholder: 'AIza...',
    keyPrefix: 'AIza',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast & capable, best value', contextWindow: 1000000, isDefault: true, isFast: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable, huge context', contextWindow: 2000000, isPremium: true },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '🐋',
    color: '#5c6bc0',
    description: 'DeepSeek — cheapest API, great quality',
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Best value — ~95% cheaper than GPT-4o', contextWindow: 64000, isDefault: true, isFast: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Chain-of-thought reasoning', contextWindow: 64000, isPremium: true },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    logo: '⚡',
    color: '#f97316',
    description: 'Groq — fastest inference on earth',
    keyPlaceholder: 'gsk_...',
    keyPrefix: 'gsk_',
    docsUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Ultra-fast open source model', contextWindow: 128000, isDefault: true, isFast: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fastest responses possible', contextWindow: 128000, isFast: true },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Strong multilingual model', contextWindow: 32000 },
    ],
  },
];

export function getProvider(id: ProviderId): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === id);
}

export function getDefaultModel(providerId: ProviderId): string {
  const provider = getProvider(providerId);
  const defaultModel = provider?.models.find(m => m.isDefault);
  return defaultModel?.id || provider?.models[0]?.id || 'gpt-4o-mini';
}

// ============================================
// CREATE AI MODEL INSTANCE
// Routes to correct SDK based on provider
// ============================================
export function createModel(providerId: ProviderId, apiKey: string, modelId: string) {
  switch (providerId) {
    case 'openai': {
      const client = createOpenAI({ apiKey });
      return client(modelId);
    }
    case 'anthropic': {
      const client = createAnthropic({ apiKey });
      return client(modelId);
    }
    case 'google': {
      const client = createGoogleGenerativeAI({ apiKey });
      return client(modelId);
    }
    case 'deepseek': {
      // DeepSeek is OpenAI-compatible
      const client = createOpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com/v1',
      });
      return client(modelId);
    }
    case 'groq': {
      // Groq is OpenAI-compatible
      const client = createOpenAI({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      return client(modelId);
    }
    default: {
      // Fallback to OpenAI
      const client = createOpenAI({ apiKey });
      return client(modelId);
    }
  }
}

// ============================================
// API KEY VALIDATION
// ============================================
export function validateApiKey(providerId: ProviderId, key: string): { valid: boolean; error?: string } {
  const provider = getProvider(providerId);
  if (!provider) return { valid: false, error: 'Unknown provider' };

  if (!key || key.trim().length < 10) {
    return { valid: false, error: 'API key is too short' };
  }

  // Provider-specific prefix validation
  switch (providerId) {
    case 'openai':
      if (!key.startsWith('sk-')) return { valid: false, error: 'OpenAI keys start with sk-' };
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
