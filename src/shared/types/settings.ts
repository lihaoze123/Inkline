import { z } from 'zod';
import {
  aiProviderIdSchema,
  hostedAiProviderIdSchema,
  providerCredentialStatusesSchema,
  providerKeyStatusSchema,
  providerKeyStatusValueSchema,
} from './credentials';

export const CURRENT_ONBOARDING_INTRO_VERSION = 1;

export const providerLabelSchema = z.enum([
  'OpenAI',
  'DeepSeek',
  'Anthropic Claude',
  'Google Gemini',
  'xAI Grok',
  'OpenRouter',
  'Custom OpenAI-compatible',
]);

const providerModelSchema = z.string().trim().min(1, 'Provider model is required.');
const providerBaseUrlSchema = z.string().trim().min(1, 'Provider base URL is required.');

export const openAiProviderConfigSchema = z.object({
  providerId: z.literal('openai'),
  provider: z.literal('OpenAI'),
  model: providerModelSchema,
  isLocalModel: z.literal(false),
});

export const deepSeekProviderConfigSchema = z.object({
  providerId: z.literal('deepseek'),
  provider: z.literal('DeepSeek'),
  model: providerModelSchema,
  isLocalModel: z.literal(false),
});

export const openAiCompatibleProviderConfigSchema = z.object({
  providerId: z.literal('openai-compatible').optional(),
  provider: z.literal('Custom OpenAI-compatible'),
  baseUrl: providerBaseUrlSchema,
  model: providerModelSchema,
  isLocalModel: z.boolean(),
});

export const anthropicProviderConfigSchema = z.object({
  providerId: z.literal('anthropic'),
  provider: z.literal('Anthropic Claude'),
  model: providerModelSchema,
  isLocalModel: z.literal(false),
});

export const googleProviderConfigSchema = z.object({
  providerId: z.literal('google'),
  provider: z.literal('Google Gemini'),
  model: providerModelSchema,
  isLocalModel: z.literal(false),
});

export const xaiProviderConfigSchema = z.object({
  providerId: z.literal('xai'),
  provider: z.literal('xAI Grok'),
  model: providerModelSchema,
  isLocalModel: z.literal(false),
});

export const openRouterProviderConfigSchema = z.object({
  providerId: z.literal('openrouter'),
  provider: z.literal('OpenRouter'),
  model: providerModelSchema,
  isLocalModel: z.literal(false),
});

export const hostedProviderConfigSchema = z.discriminatedUnion('providerId', [
  openAiProviderConfigSchema,
  deepSeekProviderConfigSchema,
  anthropicProviderConfigSchema,
  googleProviderConfigSchema,
  xaiProviderConfigSchema,
  openRouterProviderConfigSchema,
]);

export const providerConfigSchema = z.union([hostedProviderConfigSchema, openAiCompatibleProviderConfigSchema]);

export const openAiProviderSettingsSchema = openAiProviderConfigSchema.extend({
  apiKeyStatus: providerKeyStatusSchema,
});

export const deepSeekProviderSettingsSchema = deepSeekProviderConfigSchema.extend({
  apiKeyStatus: providerKeyStatusSchema,
});

export const openAiCompatibleProviderSettingsSchema = openAiCompatibleProviderConfigSchema.extend({
  providerId: z.literal('openai-compatible'),
  apiKeyStatus: providerKeyStatusSchema,
});

export const anthropicProviderSettingsSchema = anthropicProviderConfigSchema.extend({
  apiKeyStatus: providerKeyStatusSchema,
});

export const googleProviderSettingsSchema = googleProviderConfigSchema.extend({
  apiKeyStatus: providerKeyStatusSchema,
});

export const xaiProviderSettingsSchema = xaiProviderConfigSchema.extend({
  apiKeyStatus: providerKeyStatusSchema,
});

export const openRouterProviderSettingsSchema = openRouterProviderConfigSchema.extend({
  apiKeyStatus: providerKeyStatusSchema,
});

export const providerSettingsSchema = z.discriminatedUnion('providerId', [
  openAiProviderSettingsSchema,
  deepSeekProviderSettingsSchema,
  openAiCompatibleProviderSettingsSchema,
  anthropicProviderSettingsSchema,
  googleProviderSettingsSchema,
  xaiProviderSettingsSchema,
  openRouterProviderSettingsSchema,
]);

export const featureModelOverrideSchema = z.object({
  providerId: aiProviderIdSchema,
  model: providerModelSchema,
});

export const featureModelOverridesSchema = z.object({
  review: featureModelOverrideSchema.optional(),
  starterPrompt: featureModelOverrideSchema.optional(),
});

export const aiProviderSettingsMapSchema = z.object({
  openai: openAiProviderSettingsSchema,
  deepseek: deepSeekProviderSettingsSchema,
  'openai-compatible': openAiCompatibleProviderSettingsSchema,
  anthropic: anthropicProviderSettingsSchema,
  google: googleProviderSettingsSchema,
  xai: xaiProviderSettingsSchema,
  openrouter: openRouterProviderSettingsSchema,
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
  reviewThinkingEnabled: z.boolean(),
  onboardingIntroVersionSeen: z.number().int().nonnegative(),
  databaseLocation: z.string().min(1),
  piMonoAuthStatus: z.enum(['not-configured', 'configured']),
  providerApiKeyStatus: providerKeyStatusValueSchema,
  providerCredentialStatuses: providerCredentialStatusesSchema.optional(),
  aiModelSettings: aiModelSettingsSchema.optional(),
  ankiConnectStatus: z.enum(['reserved']),
});

export const setRawResponseStorageInputSchema = z.object({
  enabled: z.boolean(),
});

export const setReviewThinkingInputSchema = z.object({
  enabled: z.boolean(),
});

export const setProviderConfigInputSchema = z.union([
  z.object({
    providerId: z.literal('openai-compatible').optional(),
    baseUrl: providerBaseUrlSchema,
    model: providerModelSchema,
  }),
  z.object({
    providerId: hostedAiProviderIdSchema,
    model: providerModelSchema,
  }),
]);

export const setDefaultProviderInputSchema = z.object({
  providerId: aiProviderIdSchema,
});

export const setOnboardingIntroVersionSeenInputSchema = z.object({
  version: z.number().int().min(1),
});

export type ProviderLabel = z.infer<typeof providerLabelSchema>;
export type OpenAiProviderConfig = z.infer<typeof openAiProviderConfigSchema>;
export type DeepSeekProviderConfig = z.infer<typeof deepSeekProviderConfigSchema>;
export type OpenAiCompatibleProviderConfig = z.infer<typeof openAiCompatibleProviderConfigSchema>;
export type AnthropicProviderConfig = z.infer<typeof anthropicProviderConfigSchema>;
export type GoogleProviderConfig = z.infer<typeof googleProviderConfigSchema>;
export type XaiProviderConfig = z.infer<typeof xaiProviderConfigSchema>;
export type OpenRouterProviderConfig = z.infer<typeof openRouterProviderConfigSchema>;
export type HostedProviderConfig = z.infer<typeof hostedProviderConfigSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type OpenAiProviderSettings = z.infer<typeof openAiProviderSettingsSchema>;
export type DeepSeekProviderSettings = z.infer<typeof deepSeekProviderSettingsSchema>;
export type OpenAiCompatibleProviderSettings = z.infer<typeof openAiCompatibleProviderSettingsSchema>;
export type AnthropicProviderSettings = z.infer<typeof anthropicProviderSettingsSchema>;
export type GoogleProviderSettings = z.infer<typeof googleProviderSettingsSchema>;
export type XaiProviderSettings = z.infer<typeof xaiProviderSettingsSchema>;
export type OpenRouterProviderSettings = z.infer<typeof openRouterProviderSettingsSchema>;
export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
export type FeatureModelOverride = z.infer<typeof featureModelOverrideSchema>;
export type FeatureModelOverrides = z.infer<typeof featureModelOverridesSchema>;
export type AiProviderSettingsMap = z.infer<typeof aiProviderSettingsMapSchema>;
export type AiModelSettings = z.infer<typeof aiModelSettingsSchema>;
export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;
export type SetRawResponseStorageInput = z.infer<typeof setRawResponseStorageInputSchema>;
export type SetReviewThinkingInput = z.infer<typeof setReviewThinkingInputSchema>;
export type SetProviderConfigInput = z.input<typeof setProviderConfigInputSchema>;
export type ParsedSetProviderConfigInput = z.infer<typeof setProviderConfigInputSchema>;
export type SetDefaultProviderInput = z.infer<typeof setDefaultProviderInputSchema>;
export type SetOnboardingIntroVersionSeenInput = z.infer<typeof setOnboardingIntroVersionSeenInputSchema>;
