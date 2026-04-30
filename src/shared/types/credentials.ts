import { z } from 'zod';

export const aiProviderIdSchema = z.enum(['openai-compatible', 'anthropic']);

export const providerKeyStatusValueSchema = z.enum(['not-configured', 'configured', 'unavailable']);

export const providerKeyStatusSchema = z.object({
  providerId: aiProviderIdSchema.optional(),
  status: providerKeyStatusValueSchema,
  storage: z.literal('os-keychain'),
});

export const providerCredentialStatusesSchema = z.object({
  'openai-compatible': providerKeyStatusSchema.extend({
    providerId: z.literal('openai-compatible'),
  }),
  anthropic: providerKeyStatusSchema.extend({
    providerId: z.literal('anthropic'),
  }),
});

export const providerCredentialTargetInputSchema = z.object({
  providerId: aiProviderIdSchema.optional().default('openai-compatible'),
});

export const setProviderApiKeyInputSchema = providerCredentialTargetInputSchema.extend({
  apiKey: z.string().trim().min(1, 'Provider API key is required.'),
});

export const deleteProviderApiKeyInputSchema = z.union([
  aiProviderIdSchema,
  providerCredentialTargetInputSchema,
  z.undefined().transform(() => ({ providerId: 'openai-compatible' as const })),
]);

export const providerCredentialMutationResultSchema = z.object({
  success: z.boolean(),
  status: providerKeyStatusSchema.optional(),
  providerStatuses: providerCredentialStatusesSchema.optional(),
  error: z.string().optional(),
});

export type AiProviderId = z.infer<typeof aiProviderIdSchema>;
export type ProviderKeyStatusValue = z.infer<typeof providerKeyStatusValueSchema>;
export type ProviderKeyStatus = z.infer<typeof providerKeyStatusSchema>;
export type ProviderCredentialStatuses = z.infer<typeof providerCredentialStatusesSchema>;
export type ProviderCredentialTargetInput = z.input<typeof providerCredentialTargetInputSchema>;
export type SetProviderApiKeyInput = z.input<typeof setProviderApiKeyInputSchema>;
export type ParsedSetProviderApiKeyInput = z.infer<typeof setProviderApiKeyInputSchema>;
export type DeleteProviderApiKeyInput = z.input<typeof deleteProviderApiKeyInputSchema>;
export type ParsedDeleteProviderApiKeyInput = z.infer<typeof deleteProviderApiKeyInputSchema>;
export type ProviderCredentialMutationResult = z.infer<typeof providerCredentialMutationResultSchema>;
