import { z } from 'zod';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import { aiProviderDiagnosticsSchema } from '../../../shared/types/ai';

export const aiProviderIdSchema = z.enum(['openai-compatible', 'anthropic']);

export const aiProviderRuntimeConfigSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('openai-compatible'),
    apiKey: z.string().min(1),
    baseUrl: z.string().trim().min(1),
    model: z.string().trim().min(1),
  }),
  z.object({
    provider: z.literal('anthropic'),
    apiKey: z.string().min(1),
    model: z.string().trim().min(1),
  }),
]);

export const aiGenerationRequestSchema = z.object({
  systemPrompt: z.string().min(1),
  userPrompt: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  providerOptions: z
    .custom<ProviderOptions>((value) => typeof value === 'object' && value !== null && !Array.isArray(value))
    .optional(),
});

export const aiGenerationResultSchema = z.object({
  output: z.unknown(),
  rawOutput: z.unknown(),
  providerDiagnostics: aiProviderDiagnosticsSchema.nullable().optional(),
  provider: aiProviderIdSchema,
  model: z.string().min(1),
});

export type AiProviderId = z.infer<typeof aiProviderIdSchema>;
export type AiProviderRuntimeConfig = z.infer<typeof aiProviderRuntimeConfigSchema>;
export type AiGenerationRequest = z.infer<typeof aiGenerationRequestSchema>;
export type AiGenerationResult = z.infer<typeof aiGenerationResultSchema>;
