import { z } from 'zod';

export const providerKeyStatusSchema = z.object({
  status: z.enum(['not-configured', 'configured', 'unavailable']),
  storage: z.literal('os-keychain'),
});

export const setProviderApiKeyInputSchema = z.object({
  apiKey: z.string().trim().min(1, 'Provider API key is required.'),
});

export const providerCredentialMutationResultSchema = z.object({
  success: z.boolean(),
  status: providerKeyStatusSchema.optional(),
  error: z.string().optional(),
});

export type ProviderKeyStatus = z.infer<typeof providerKeyStatusSchema>;
export type SetProviderApiKeyInput = z.infer<typeof setProviderApiKeyInputSchema>;
export type ProviderCredentialMutationResult = z.infer<typeof providerCredentialMutationResultSchema>;
