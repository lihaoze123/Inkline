import type { WritingAttemptSnapshot } from '@shared/types/writing';
import { describe, expect, it } from 'vitest';
import { createRendererQueryClient } from '../src/renderer/query/client';
import { queryKeys } from '../src/renderer/query/keys';
import { updateWritingAttemptCache } from '../src/renderer/query/writing';

describe('renderer query configuration', () => {
  it('uses stable query keys for foundation data', () => {
    expect(queryKeys.writing.attempt('journal')).toEqual(['writing', 'attempt', 'journal']);
    expect(queryKeys.settings.snapshot).toEqual(['settings']);
    expect(queryKeys.app.startupStatus).toEqual(['app', 'startup-status']);
  });

  it('disables network-style retries and focus refetching for local IPC calls', () => {
    const queryClient = createRendererQueryClient();
    const queryDefaults = queryClient.getDefaultOptions().queries;
    const mutationDefaults = queryClient.getDefaultOptions().mutations;

    expect(queryDefaults?.retry).toBe(false);
    expect(queryDefaults?.refetchOnWindowFocus).toBe(false);
    expect(queryDefaults?.staleTime).toBe(30_000);
    expect(mutationDefaults?.retry).toBe(false);
  });

  it('writes successful writing mutations to the template-scoped cache key', () => {
    const queryClient = createRendererQueryClient();
    const savedWriting: WritingAttemptSnapshot = {
      attemptId: 'attempt-cet4',
      dateKey: '2026-04-30',
      templateId: 'cet4',
      template: {
        id: 'cet4',
        title: 'CET-4 Writing',
        description: 'Practice CET-4 writing.',
        starterPromptBehavior: 'Generate a CET-4 topic.',
        reviewFocus: 'Task response and organization.',
        scenarioContext: 'CET-4',
      },
      generatedPrompt: null,
      userGoal: 'Improve structure',
      activeRevision: {
        id: 'revision-cet4',
        writingAttemptId: 'attempt-cet4',
        content: 'Draft content',
        contentHash: 'hash-cet4',
        createdAt: 1777546800000,
      },
      lastAutosaveAt: 1777546800000,
      lastReviewRunId: null,
      staleReview: null,
      pendingRewritePractice: null,
    };

    updateWritingAttemptCache(queryClient, savedWriting);

    expect(queryClient.getQueryData(queryKeys.writing.attempt('cet4'))).toEqual(savedWriting);
    expect(queryClient.getQueryData(queryKeys.writing.attempt('journal'))).toBeUndefined();
  });
});
