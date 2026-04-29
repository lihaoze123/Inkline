import { z } from 'zod';

export const providerConfigSchema = z.object({
  provider: z.literal('OpenAI-compatible'),
  baseUrl: z.string().trim().min(1, 'Provider base URL is required.'),
  model: z.string().trim().min(1, 'Provider model is required.'),
  isLocalModel: z.boolean(),
});

export const settingsSnapshotSchema = z.object({
  provider: z.string().min(1),
  baseUrl: z.string().min(1),
  model: z.string().min(1),
  isLocalModel: z.boolean(),
  reviewContextDescription: z.string().min(1),
  rawResponseStorageEnabled: z.boolean(),
  databaseLocation: z.string().min(1),
  piMonoAuthStatus: z.enum(['not-configured', 'configured']),
  providerApiKeyStatus: z.enum(['not-configured', 'configured', 'unavailable']),
  ankiConnectStatus: z.enum(['reserved']),
});

export const setRawResponseStorageInputSchema = z.object({
  enabled: z.boolean(),
});

export const setProviderConfigInputSchema = providerConfigSchema.pick({ baseUrl: true, model: true });

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;
export type SetRawResponseStorageInput = z.infer<typeof setRawResponseStorageInputSchema>;
export type SetProviderConfigInput = z.infer<typeof setProviderConfigInputSchema>;
