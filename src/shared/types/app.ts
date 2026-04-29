import { z } from 'zod';

export const startupStatusSchema = z.object({
  databaseReady: z.boolean(),
  databaseLocation: z.string().min(1),
  migrationsApplied: z.boolean(),
});

export type StartupStatus = z.infer<typeof startupStatusSchema>;
