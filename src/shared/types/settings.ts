import { z } from 'zod';
import { aiProviderIdSchema, providerKeyStatusSchema, providerKeyStatusValueSchema } from './credentials';

export const providerLabelSchema = z.enum(['OpenAI-compatible', 'Anthropic Claude']);

export const openAiCompatibleProviderConfigSchema = z.object({
  providerId: z.literal('openai-compatible').optional(),
  provider: z.literal('OpenAI-compatible'),
  baseUrl: z.string().trim().min(1, 'Provider base URL is required.'),
  model: z.string().trim().min(1, 'Provider model is required.'),
  isLocalModel: z.boolean(),
});

export const anthropicProviderConfigSchema = z.object({
  providerId: z.literal('anthropic'),
  provider: z.literal('Anthropic Claude'),
  model: z.string().trim().min(1, 'Provider model is required.'),
  isLocalModel: z.literal(false),
});

export const providerConfigSchema = z.union([openAiCompatibleProviderConfigSchema, anthropicProviderConfigSchema]);

export const openAiCompatibleProviderSettingsSchema = openAiCompatibleProviderConfigSchema.extend({
  providerId: z.literal('openai-compatible'),
  apiKeyStatus: providerKeyStatusSchema,
});

export const anthropicProviderSettingsSchema = anthropicProviderConfigSchema.extend({
  apiKeyStatus: providerKeyStatusSchema,
});

export const providerSettingsSchema = z.discriminatedUnion('providerId', [
  openAiCompatibleProviderSettingsSchema,
  anthropicProviderSettingsSchema,
]);

export const featureModelOverrideSchema = z.object({
  providerId: aiProviderIdSchema,
  model: z.string().trim().min(1, 'Provider model is required.'),
});

export const featureModelOverridesSchema = z.object({
  review: featureModelOverrideSchema.optional(),
  starterPrompt: featureModelOverrideSchema.optional(),
});

export const aiProviderSettingsMapSchema = z.object({
  'openai-compatible': openAiCompatibleProviderSettingsSchema,
  anthropic: anthropicProviderSettingsSchema,
});

export const aiModelSettingsSchema = z.object({
  defaultProviderId: aiProviderIdSchema,
  providers: aiProviderSettingsMapSchema,
  featureOverrides: featureModelOverridesSchema,
});

export const settingsSnapshotSchema = z.object({
  providerId: aiProviderIdSchema.optional(),
  provider: providerLabelSchema.or(z.string().min(1)),
  baseUrl: z.string().min(1),
  model: z.string().min(1),
  isLocalModel: z.boolean(),
  reviewContextDescription: z.string().min(1),
  rawResponseStorageEnabled: z.boolean(),
  databaseLocation: z.string().min(1),
  piMonoAuthStatus: z.enum(['not-configured', 'configured']),
  providerApiKeyStatus: providerKeyStatusValueSchema,
  providerCredentialStatuses: z.object({
    'openai-compatible': providerKeyStatusSchema.extend({ providerId: z.literal('openai-compatible') }),
    anthropic: providerKeyStatusSchema.extend({ providerId: z.literal('anthropic') }),
  }).optional(),
  aiModelSettings: aiModelSettingsSchema.optional(),
  ankiConnectStatus: z.enum(['reserved']),
});

export const setRawResponseStorageInputSchema = z.object({
  enabled: z.boolean(),
});

export const setProviderConfigInputSchema = z.union([
  z.object({
    providerId: z.literal('openai-compatible').optional(),
    baseUrl: z.string().trim().min(1, 'Provider base URL is required.'),
    model: z.string().trim().min(1, 'Provider model is required.'),
  }),
  z.object({
    providerId: z.literal('anthropic'),
    model: z.string().trim().min(1, 'Provider model is required.'),
  }),
]);

export const setDefaultProviderInputSchema = z.object({
  providerId: aiProviderIdSchema,
});

export type ProviderLabel = z.infer<typeof providerLabelSchema>;
export type OpenAiCompatibleProviderConfig = z.infer<typeof openAiCompatibleProviderConfigSchema>;
export type AnthropicProviderConfig = z.infer<typeof anthropicProviderConfigSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type OpenAiCompatibleProviderSettings = z.infer<typeof openAiCompatibleProviderSettingsSchema>;
export type AnthropicProviderSettings = z.infer<typeof anthropicProviderSettingsSchema>;
export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
export type FeatureModelOverride = z.infer<typeof featureModelOverrideSchema>;
export type FeatureModelOverrides = z.infer<typeof featureModelOverridesSchema>;
export type AiProviderSettingsMap = z.infer<typeof aiProviderSettingsMapSchema>;
export type AiModelSettings = z.infer<typeof aiModelSettingsSchema>;
export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;
export type SetRawResponseStorageInput = z.infer<typeof setRawResponseStorageInputSchema>;
export type SetProviderConfigInput = z.input<typeof setProviderConfigInputSchema>;
export type ParsedSetProviderConfigInput = z.infer<typeof setProviderConfigInputSchema>;
export type SetDefaultProviderInput = z.infer<typeof setDefaultProviderInputSchema>;
