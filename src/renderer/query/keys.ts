import type { WritingTemplateId } from '@shared/types/writing';

export const queryKeys = {
  app: {
    startupStatus: ['app', 'startup-status'] as const,
  },
  settings: {
    snapshot: ['settings'] as const,
  },
  writing: {
    attempt: (templateId: WritingTemplateId) => ['writing', 'attempt', templateId] as const,
  },
} as const;
