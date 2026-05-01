import { z } from 'zod';

export const startupStatusSchema = z.object({
  databaseReady: z.boolean(),
  databaseLocation: z.string().min(1),
  migrationsApplied: z.boolean(),
  timeZone: z.string().min(1),
  timeZoneOffsetMinutes: z
    .number()
    .int()
    .min(-14 * 60)
    .max(14 * 60),
});

export type StartupStatus = z.infer<typeof startupStatusSchema>;
