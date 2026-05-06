import type { RewriteCheckSnapshot, WritingAttemptSnapshot } from '@shared/types/writing';
import { describe, expect, it } from 'vitest';
import { createRendererQueryClient } from '../src/renderer/query/client';
import { queryKeys } from '../src/renderer/query/keys';
import { setReviewPreviewCache } from '../src/renderer/query/review';
import { updateSettingsCache } from '../src/renderer/query/settings';
import { updateRewritePracticeCache, updateWritingAttemptCache } from '../src/renderer/query/writing';
import type { SettingsSnapshot } from '../src/shared/types/settings';

describe('renderer query configuration', () => {
  it('uses stable query keys for foundation data', () => {
    expect(queryKeys.writing.attempts).toEqual(['writing', 'attempt']);
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

  it('updates pending rewrite practice across cached writing attempts', () => {
    const queryClient = createRendererQueryClient();
    const pendingRewritePractice: NonNullable<WritingAttemptSnapshot['pendingRewritePractice']> = {
      id: 'rewrite-1',
      reviewRunId: 'review-run-1',
      originalSentence: 'it can make people more confidence',
      focusPattern: 'make + object + adjective',
      nativeModelSentence: 'it can make people more confident',
      prompt: 'Rewrite the sentence with the adjective form.',
      practiceKind: 'rewrite_original',
      spacedStage: 'D+1',
      status: 'pending',
      userRewriteText: null,
      latestRewriteCheck: null,
      dueAt: 1777546800000,
      createdAt: 1777460400000,
      isOlderThanSevenDays: false,
    };
    const journalWriting: WritingAttemptSnapshot = {
      ...makeWritingAttempt(),
      attemptId: 'attempt-journal',
      templateId: 'journal',
      pendingRewritePractice,
    };
    const freeWriting: WritingAttemptSnapshot = {
      ...makeWritingAttempt(),
      attemptId: 'attempt-free',
      templateId: 'free',
      pendingRewritePractice,
    };

    queryClient.setQueryData(queryKeys.writing.attempt('journal'), journalWriting);
    queryClient.setQueryData(queryKeys.writing.attempt('free'), freeWriting);

    updateRewritePracticeCache(queryClient, {
      success: true,
      writing: { ...freeWriting, pendingRewritePractice: null },
      rewritePractice: {
        ...pendingRewritePractice,
        status: 'completed',
        userRewriteText: 'it can make people more confident',
      },
    });

    expect(queryClient.getQueryData<WritingAttemptSnapshot>(queryKeys.writing.attempt('journal'))).toMatchObject({
      attemptId: 'attempt-journal',
      pendingRewritePractice: null,
    });
    expect(queryClient.getQueryData<WritingAttemptSnapshot>(queryKeys.writing.attempt('free'))).toMatchObject({
      attemptId: 'attempt-free',
      pendingRewritePractice: null,
    });
  });

  it('removes snoozed rewrite practice from cached writing attempts', () => {
    const queryClient = createRendererQueryClient();
    const pendingRewritePractice: NonNullable<WritingAttemptSnapshot['pendingRewritePractice']> = {
      id: 'rewrite-1',
      reviewRunId: 'review-run-1',
      originalSentence: 'it can make people more confidence',
      focusPattern: 'make + object + adjective',
      nativeModelSentence: 'it can make people more confident',
      prompt: 'Rewrite the sentence with the adjective form.',
      practiceKind: 'rewrite_original',
      spacedStage: 'D+1',
      status: 'pending',
      userRewriteText: null,
      latestRewriteCheck: null,
      dueAt: 1777546800000,
      createdAt: 1777460400000,
      isOlderThanSevenDays: false,
    };
    const journalWriting: WritingAttemptSnapshot = {
      ...makeWritingAttempt(),
      attemptId: 'attempt-journal',
      templateId: 'journal',
      pendingRewritePractice,
    };
    const freeWriting: WritingAttemptSnapshot = {
      ...makeWritingAttempt(),
      attemptId: 'attempt-free',
      templateId: 'free',
      pendingRewritePractice,
    };

    queryClient.setQueryData(queryKeys.writing.attempt('journal'), journalWriting);
    queryClient.setQueryData(queryKeys.writing.attempt('free'), freeWriting);

    updateRewritePracticeCache(queryClient, {
      success: true,
      writing: { ...freeWriting, pendingRewritePractice: null },
      rewritePractice: {
        ...pendingRewritePractice,
        status: 'snoozed',
        dueAt: 1777633200000,
      },
    });

    expect(queryClient.getQueryData<WritingAttemptSnapshot>(queryKeys.writing.attempt('journal'))).toMatchObject({
      pendingRewritePractice: null,
    });
    expect(queryClient.getQueryData<WritingAttemptSnapshot>(queryKeys.writing.attempt('free'))).toMatchObject({
      pendingRewritePractice: null,
    });
  });

  it('updates rewrite practice cache from a completion result with persisted check feedback', () => {
    const queryClient = createRendererQueryClient();
    const completedCheck: RewriteCheckSnapshot = {
      id: 'rewrite-check-complete',
      rewriteTaskId: 'rewrite-1',
      status: 'completed',
      outcome: 'correct',
      feedback: {
        message: 'The rewrite repairs the focus pattern.',
        nextStep: 'Use this adjective pattern again in a new sentence.',
      },
      provider: 'OpenAI-compatible',
      model: 'gpt-4o-mini',
      validationErrors: null,
      errorMessage: null,
      diagnostics: null,
      createdAt: 1777546800000,
      updatedAt: 1777546860000,
      completedAt: 1777546860000,
    };
    const pendingRewritePractice: NonNullable<WritingAttemptSnapshot['pendingRewritePractice']> = {
      id: 'rewrite-1',
      reviewRunId: 'review-run-1',
      originalSentence: 'it can make people more confidence',
      focusPattern: 'make + object + adjective',
      nativeModelSentence: 'it can make people more confident',
      prompt: 'Rewrite the sentence with the adjective form.',
      practiceKind: 'rewrite_original',
      spacedStage: 'D+1',
      status: 'pending',
      userRewriteText: null,
      latestRewriteCheck: null,
      dueAt: 1777546800000,
      createdAt: 1777460400000,
      isOlderThanSevenDays: false,
    };
    const completedRewritePractice = {
      ...pendingRewritePractice,
      status: 'completed' as const,
      userRewriteText: 'it can make people more confident',
      latestRewriteCheck: completedCheck,
    };
    const writing = {
      ...makeWritingAttempt(),
      pendingRewritePractice,
    };

    queryClient.setQueryData(queryKeys.writing.attempt('cet4'), writing);

    updateRewritePracticeCache(queryClient, {
      success: true,
      writing: {
        ...writing,
        pendingRewritePractice: completedRewritePractice,
      },
      rewritePractice: completedRewritePractice,
    });

    expect(queryClient.getQueryData<WritingAttemptSnapshot>(queryKeys.writing.attempt('cet4'))).toMatchObject({
      pendingRewritePractice: {
        status: 'completed',
        userRewriteText: 'it can make people more confident',
        latestRewriteCheck: {
          status: 'completed',
          outcome: 'correct',
          feedback: {
            message: 'The rewrite repairs the focus pattern.',
          },
        },
      },
    });
  });

  it('updates rewrite practice cache from a retry check result', () => {
    const queryClient = createRendererQueryClient();
    const retryableCheck: RewriteCheckSnapshot = {
      id: 'rewrite-check-1',
      rewriteTaskId: 'rewrite-1',
      status: 'retryable',
      outcome: null,
      feedback: null,
      provider: 'OpenAI-compatible',
      model: 'gpt-4o-mini',
      validationErrors: null,
      errorMessage: 'Provider request failed.',
      diagnostics: null,
      createdAt: 1777546800000,
      updatedAt: 1777546800000,
      completedAt: null,
    };
    const retryableRewritePractice: NonNullable<WritingAttemptSnapshot['pendingRewritePractice']> = {
      id: 'rewrite-1',
      reviewRunId: 'review-run-1',
      originalSentence: 'it can make people more confidence',
      focusPattern: 'make + object + adjective',
      nativeModelSentence: 'it can make people more confident',
      prompt: 'Rewrite the sentence with the adjective form.',
      practiceKind: 'rewrite_original',
      spacedStage: 'D+1',
      status: 'completed',
      userRewriteText: 'it can make people more confident',
      latestRewriteCheck: retryableCheck,
      dueAt: 1777546800000,
      createdAt: 1777460400000,
      isOlderThanSevenDays: false,
    };
    const writing = {
      ...makeWritingAttempt(),
      pendingRewritePractice: retryableRewritePractice,
    };
    const checkedRewritePractice = {
      ...retryableRewritePractice,
      latestRewriteCheck: {
        ...retryableCheck,
        status: 'completed' as const,
        outcome: 'partly_correct' as const,
        feedback: {
          message: 'The adjective form is now correct, but the sentence still needs a clearer subject.',
          nextStep: 'Keep the adjective after the object.',
        },
        errorMessage: null,
        completedAt: 1777546860000,
      },
    };

    queryClient.setQueryData(queryKeys.writing.attempt('cet4'), writing);

    updateRewritePracticeCache(queryClient, {
      success: true,
      writing: {
        ...writing,
        pendingRewritePractice: checkedRewritePractice,
      },
      rewritePractice: checkedRewritePractice,
      rewriteCheck: checkedRewritePractice.latestRewriteCheck,
    });

    expect(queryClient.getQueryData<WritingAttemptSnapshot>(queryKeys.writing.attempt('cet4'))).toMatchObject({
      pendingRewritePractice: {
        latestRewriteCheck: {
          status: 'completed',
          outcome: 'partly_correct',
          feedback: {
            nextStep: 'Keep the adjective after the object.',
          },
        },
      },
    });
  });

  it('updates cached latest rewrite check when retry result omits writing snapshot', () => {
    const queryClient = createRendererQueryClient();
    const retryableCheck: RewriteCheckSnapshot = {
      id: 'rewrite-check-1',
      rewriteTaskId: 'rewrite-1',
      status: 'retryable',
      outcome: null,
      feedback: null,
      provider: 'OpenAI-compatible',
      model: 'gpt-4o-mini',
      validationErrors: null,
      errorMessage: 'Provider request failed.',
      diagnostics: null,
      createdAt: 1777546800000,
      updatedAt: 1777546800000,
      completedAt: null,
    };
    const checkedCheck: RewriteCheckSnapshot = {
      ...retryableCheck,
      status: 'completed',
      outcome: 'incorrect',
      feedback: {
        message: 'The rewrite still uses the noun form after make.',
        nextStep: 'Use the adjective form after the object.',
      },
      errorMessage: null,
      updatedAt: 1777546860000,
      completedAt: 1777546860000,
    };
    const retryableRewritePractice: NonNullable<WritingAttemptSnapshot['pendingRewritePractice']> = {
      id: 'rewrite-1',
      reviewRunId: 'review-run-1',
      originalSentence: 'it can make people more confidence',
      focusPattern: 'make + object + adjective',
      nativeModelSentence: 'it can make people more confident',
      prompt: 'Rewrite the sentence with the adjective form.',
      practiceKind: 'rewrite_original',
      spacedStage: 'D+1',
      status: 'completed',
      userRewriteText: 'it can make people more confidence',
      latestRewriteCheck: retryableCheck,
      dueAt: 1777546800000,
      createdAt: 1777460400000,
      isOlderThanSevenDays: false,
    };

    queryClient.setQueryData(queryKeys.writing.attempt('cet4'), {
      ...makeWritingAttempt(),
      pendingRewritePractice: retryableRewritePractice,
    });

    updateRewritePracticeCache(queryClient, {
      success: true,
      rewriteCheck: checkedCheck,
    });

    expect(queryClient.getQueryData<WritingAttemptSnapshot>(queryKeys.writing.attempt('cet4'))).toMatchObject({
      pendingRewritePractice: {
        latestRewriteCheck: {
          status: 'completed',
          outcome: 'incorrect',
          feedback: {
            nextStep: 'Use the adjective form after the object.',
          },
        },
      },
    });
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
    reviewThinkingEnabled: false,
    onboardingIntroVersionSeen: 1,
    databaseLocation: '/tmp/Inkline.db',
    piMonoAuthStatus: 'not-configured',
    providerApiKeyStatus: 'configured',
    providerCredentialStatuses: {
      openai: {
        providerId: 'openai',
        status: 'not-configured',
        storage: 'os-keychain',
      },
      deepseek: {
        providerId: 'deepseek',
        status: 'not-configured',
        storage: 'os-keychain',
      },
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
      google: {
        providerId: 'google',
        status: 'not-configured',
        storage: 'os-keychain',
      },
      xai: {
        providerId: 'xai',
        status: 'not-configured',
        storage: 'os-keychain',
      },
      openrouter: {
        providerId: 'openrouter',
        status: 'not-configured',
        storage: 'os-keychain',
      },
    },
    aiModelSettings: {
      defaultProviderId: 'openai-compatible',
      providers: {
        openai: {
          providerId: 'openai',
          provider: 'OpenAI',
          model: 'gpt-4o-mini',
          isLocalModel: false,
          apiKeyStatus: {
            providerId: 'openai',
            status: 'not-configured',
            storage: 'os-keychain',
          },
        },
        deepseek: {
          providerId: 'deepseek',
          provider: 'DeepSeek',
          model: 'deepseek-chat',
          isLocalModel: false,
          apiKeyStatus: {
            providerId: 'deepseek',
            status: 'not-configured',
            storage: 'os-keychain',
          },
        },
        'openai-compatible': {
          providerId: 'openai-compatible',
          provider: 'Custom OpenAI-compatible',
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
        google: {
          providerId: 'google',
          provider: 'Google Gemini',
          model: 'gemini-2.5-flash',
          isLocalModel: false,
          apiKeyStatus: {
            providerId: 'google',
            status: 'not-configured',
            storage: 'os-keychain',
          },
        },
        xai: {
          providerId: 'xai',
          provider: 'xAI Grok',
          model: 'grok-4-fast-non-reasoning',
          isLocalModel: false,
          apiKeyStatus: {
            providerId: 'xai',
            status: 'not-configured',
            storage: 'os-keychain',
          },
        },
        openrouter: {
          providerId: 'openrouter',
          provider: 'OpenRouter',
          model: 'openai/gpt-4o-mini',
          isLocalModel: false,
          apiKeyStatus: {
            providerId: 'openrouter',
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
