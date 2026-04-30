import type { WritingAttemptSnapshot } from '@shared/types/writing';
import { describe, expect, it } from 'vitest';
import { createRendererQueryClient } from '../src/renderer/query/client';
import { queryKeys } from '../src/renderer/query/keys';
import { setReviewPreviewCache } from '../src/renderer/query/review';
import { updateSettingsCache } from '../src/renderer/query/settings';
import { updateWritingAttemptCache } from '../src/renderer/query/writing';
import type { SettingsSnapshot } from '../src/shared/types/settings';

describe('renderer query configuration', () => {
  it('uses stable query keys for foundation data', () => {
    expect(queryKeys.writing.attempt('journal')).toEqual(['writing', 'attempt', 'journal']);
    expect(queryKeys.settings.snapshot).toEqual(['settings']);
    expect(queryKeys.app.startupStatus).toEqual(['app', 'startup-status']);
    expect(queryKeys.review.run('review-run-1')).toEqual(['review', 'run', 'review-run-1']);
    expect(queryKeys.review.preview('review-run-1')).toEqual(['review', 'preview', 'review-run-1']);
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
    const savedWriting = makeWritingAttempt();

    updateWritingAttemptCache(queryClient, savedWriting);

    expect(queryClient.getQueryData(queryKeys.writing.attempt('cet4'))).toEqual(savedWriting);
    expect(queryClient.getQueryData(queryKeys.writing.attempt('journal'))).toBeUndefined();
  });

  it('writes successful settings mutations to the settings snapshot cache key', () => {
    const queryClient = createRendererQueryClient();
    const settings = makeSettingsSnapshot();

    updateSettingsCache(queryClient, settings);

    expect(queryClient.getQueryData(queryKeys.settings.snapshot)).toEqual(settings);
  });

  it('writes review preview snapshots to the review-run-scoped cache key', () => {
    const queryClient = createRendererQueryClient();
    const preview = {
      reviewRun: {
        id: 'review-run-1',
      },
      reviewedContent: 'Reviewed text',
      isStaleForCurrentWriting: false,
    };

    setReviewPreviewCache(queryClient, { reviewRunId: 'review-run-1' }, preview as never);

    expect(queryClient.getQueryData(queryKeys.review.preview('review-run-1'))).toEqual(preview);
    expect(queryClient.getQueryData(queryKeys.review.preview('review-run-2'))).toBeUndefined();
  });
});

function makeWritingAttempt(): WritingAttemptSnapshot {
  return {
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
}

function makeSettingsSnapshot(): SettingsSnapshot {
  return {
    providerId: 'openai-compatible',
    provider: 'OpenAI-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    isLocalModel: false,
    reviewContextDescription: 'Test context',
    rawResponseStorageEnabled: false,
    databaseLocation: '/tmp/english-coach.db',
    piMonoAuthStatus: 'not-configured',
    providerApiKeyStatus: 'configured',
    providerCredentialStatuses: {
      'openai-compatible': {
        providerId: 'openai-compatible',
        status: 'configured',
        storage: 'os-keychain',
      },
      anthropic: {
        providerId: 'anthropic',
        status: 'not-configured',
        storage: 'os-keychain',
      },
    },
    aiModelSettings: {
      defaultProviderId: 'openai-compatible',
      providers: {
        'openai-compatible': {
          providerId: 'openai-compatible',
          provider: 'OpenAI-compatible',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          isLocalModel: false,
          apiKeyStatus: {
            providerId: 'openai-compatible',
            status: 'configured',
            storage: 'os-keychain',
          },
        },
        anthropic: {
          providerId: 'anthropic',
          provider: 'Anthropic Claude',
          model: 'claude-3-5-sonnet-latest',
          isLocalModel: false,
          apiKeyStatus: {
            providerId: 'anthropic',
            status: 'not-configured',
            storage: 'os-keychain',
          },
        },
      },
      featureOverrides: {},
    },
    ankiConnectStatus: 'reserved',
  };
}
