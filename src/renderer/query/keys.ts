import type { WritingTemplateId } from '@shared/types/writing';

export const queryKeys = {
  app: {
    startupStatus: ['app', 'startup-status'] as const,
  },
  settings: {
    snapshot: ['settings'] as const,
  },
  writing: {
    attempts: ['writing', 'attempt'] as const,
    attempt: (templateId: WritingTemplateId) => ['writing', 'attempt', templateId] as const,
  },
  review: {
    run: (reviewRunId: string) => ['review', 'run', reviewRunId] as const,
    preview: (reviewRunId: string) => ['review', 'preview', reviewRunId] as const,
  },
  learningAssets: {
    errorPatterns: ['learning-assets', 'error-patterns'] as const,
    notebookEntries: ['learning-assets', 'notebook-entries'] as const,
    learningEvents: ['learning-assets', 'learning-events'] as const,
  },
} as const;
