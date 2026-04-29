import { z } from 'zod';

export const providerKeyStatusSchema = z.object({
  status: z.enum(['not-configured', 'configured', 'unavailable']),
  storage: z.literal('os-keychain'),
});

export type ProviderKeyStatus = z.infer<typeof providerKeyStatusSchema>;
