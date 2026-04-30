import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { StartupStatus } from '@shared/types/app';
import type { WritingAttemptSnapshot, WritingTemplateId } from '@shared/types/writing';
import { WRITING_TEMPLATES } from '@shared/writing/templates';
import type { ReviewPreviewSnapshot, ReviewProgressEvent, ReviewRunSnapshot } from '@shared/types/review';
import type { AiProviderId } from '@shared/types/credentials';
import type { SettingsSnapshot } from '@shared/types/settings';
import { WritingEditorCard } from './components/WritingEditorCard';
import { LearningPanel } from './components/LearningPanel';
import { PracticeTemplatePicker } from './components/PracticeTemplatePicker';
import { RevealAnswerDialog } from './components/RevealAnswerDialog';
import { ReviewDisclosureDialog } from './components/ReviewDisclosureDialog';
import { SettingsDrawer } from './components/SettingsDrawer';
import { PracticeHeader } from './components/PracticeHeader';
import { getFocusCorrection } from './components/review-utils';
import type { AppStatusModel, ReviewProgressModel, ReviewState, SaveState } from './components/types';
import { useFoundationState } from './query/foundation';
import { queryKeys } from './query/keys';
import { setReviewPreviewCache, useSaveReview, useStartReview } from './query/review';
import {
  useDeleteProviderApiKey,
  useSetDefaultProvider,
  useSetProviderApiKey,
  useSetProviderConfig,
  useSetRawResponseStorage,
  useSettingsSnapshot,
} from './query/settings';
import {
  updateWritingAttemptCache,
  useCompleteRewritePractice,
  useGenerateStarterPrompt,
  useSaveWritingAttempt,
  useSkipRewritePractice,
  useWritingAttempt,
} from './query/writing';

const AUTOSAVE_DELAY_MS = 900;

function emptyReviewProgress(): ReviewProgressModel {
  return {
    activeRunId: null,
    events: [],
    currentEvent: null,
    startedAt: null,
  };
}

export function App(): React.JSX.Element {
  const foundationState = useFoundationState();

  if (foundationState.status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-base-200 p-8">
        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-8 text-center shadow-xl">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-4 font-medium text-base-content/70">Loading practice...</p>
        </div>
      </main>
    );
  }

  if (foundationState.status === 'error') {
    return (
      <main className="grid min-h-screen place-items-center bg-base-200 p-8">
        <div className="alert alert-error max-w-lg rounded-[1.5rem] shadow-xl">
          <span>{foundationState.message}</span>
        </div>
      </main>
    );
  }

  return (
    <PracticePage
      initialWriting={foundationState.data.writing}
      settings={foundationState.data.settings}
      startup={foundationState.data.startup}
    />
  );
}

type PracticePageProps = {
  initialWriting: WritingAttemptSnapshot;
  settings: SettingsSnapshot;
  startup: StartupStatus;
};

function PracticePage({ initialWriting, settings, startup }: PracticePageProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<WritingTemplateId>(initialWriting.templateId);
  const writingQuery = useWritingAttempt({
    templateId: selectedTemplateId,
    initialData: selectedTemplateId === initialWriting.templateId ? initialWriting : undefined,
  });
  const settingsQuery = useSettingsSnapshot(settings);
  const appSettings = settingsQuery.data ?? settings;
  const { mutateAsync: saveWritingAttempt } = useSaveWritingAttempt();
  const { mutateAsync: startReview } = useStartReview();
  const { mutateAsync: saveReviewMutation } = useSaveReview();
  const { mutateAsync: generateStarterPromptMutation } = useGenerateStarterPrompt();
  const { mutateAsync: completeRewritePracticeMutation } = useCompleteRewritePractice();
  const { mutateAsync: skipRewritePracticeMutation } = useSkipRewritePractice();
  const { mutateAsync: setDefaultProviderMutation } = useSetDefaultProvider();
  const { mutateAsync: setProviderConfigMutation } = useSetProviderConfig();
  const { mutateAsync: setProviderApiKeyMutation } = useSetProviderApiKey();
  const { mutateAsync: deleteProviderApiKeyMutation } = useDeleteProviderApiKey();
  const { mutateAsync: setRawResponseStorageMutation } = useSetRawResponseStorage();
  const writing = writingQuery.data ?? initialWriting;
  const [content, setContent] = useState(initialWriting.activeRevision?.content ?? '');
  const [userGoal, setUserGoal] = useState(initialWriting.userGoal ?? '');
  const [starterPromptState, setStarterPromptState] = useState<'idle' | 'generating' | 'error'>('idle');
  const [starterPromptError, setStarterPromptError] = useState<string | null>(null);
  const [showStarterDisclosure, setShowStarterDisclosure] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>('idle');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewProgress, setReviewProgress] = useState<ReviewProgressModel>(() => emptyReviewProgress());
  const [latestReviewRun, setLatestReviewRun] = useState<ReviewRunSnapshot | null>(null);
  const [reviewPreview, setReviewPreview] = useState<ReviewPreviewSnapshot | null>(null);
  const [selfRepairAttempt, setSelfRepairAttempt] = useState('');
  const [modelAnswerRevealed, setModelAnswerRevealed] = useState(false);
  const [rewritePracticeInput, setRewritePracticeInput] = useState('');
  const [completedRewritePractice, setCompletedRewritePractice] =
    useState<WritingAttemptSnapshot['pendingRewritePractice']>(null);
  const [rewritePracticeError, setRewritePracticeError] = useState<string | null>(null);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showRevealConfirmation, setShowRevealConfirmation] = useState(false);
  const [openAiBaseUrlInput, setOpenAiBaseUrlInput] = useState(
    settings.aiModelSettings?.providers['openai-compatible'].baseUrl ?? settings.baseUrl,
  );
  const [openAiModelInput, setOpenAiModelInput] = useState(
    settings.aiModelSettings?.providers['openai-compatible'].model ?? settings.model,
  );
  const [anthropicModelInput, setAnthropicModelInput] = useState(
    settings.aiModelSettings?.providers.anthropic.model ?? '',
  );
  const [providerApiKeyInputs, setProviderApiKeyInputs] = useState<Record<AiProviderId, string>>({
    'openai-compatible': '',
    anthropic: '',
  });
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const lastSavedContentRef = useRef(initialWriting.activeRevision?.content ?? '');
  const activeReviewRef = useRef(false);

  const updateWritingCache = useCallback(
    (nextWriting: WritingAttemptSnapshot): void => {
      updateWritingAttemptCache(queryClient, nextWriting);
    },
    [queryClient],
  );

  const hasWritten = content.trim().length > 0;
  const appStatus = useMemo(() => getAppStatus(startup, appSettings), [appSettings, startup]);
  const focusCorrection = reviewPreview ? getFocusCorrection(reviewPreview) : null;
  const highlightedContent =
    reviewPreview && focusCorrection && reviewPreview.isStaleForCurrentWriting === false
      ? reviewPreview.reviewedContent
      : null;
  const highlightedCorrections =
    reviewPreview && focusCorrection && reviewPreview.isStaleForCurrentWriting === false
      ? reviewPreview.operations.corrections
      : [];

  useEffect(() => {
    return window.api.review.onProgress((event: ReviewProgressEvent) => {
      setReviewProgress((current) => {
        if (!activeReviewRef.current || (current.activeRunId && current.activeRunId !== event.runId)) {
          return current;
        }

        return {
          activeRunId: event.runId,
          events: [...current.events, event],
          currentEvent: event,
          startedAt: current.startedAt ?? event.at - event.elapsedMs,
        };
      });
    });
  }, []);

  const selectTemplate = useCallback(
    async (templateId: WritingTemplateId): Promise<void> => {
      const nextWriting = await queryClient.fetchQuery({
        queryKey: queryKeys.writing.attempt(templateId),
        queryFn: () => window.api.writing.getWritingAttempt({ templateId }),
      });
      setSelectedTemplateId(templateId);
      setContent(nextWriting.activeRevision?.content ?? '');
      setUserGoal(nextWriting.userGoal ?? '');
      lastSavedContentRef.current = nextWriting.activeRevision?.content ?? '';
      setReviewPreview(null);
      setLatestReviewRun(null);
      setReviewState('idle');
      setReviewError(null);
      setCompletedRewritePractice(null);
      setRewritePracticeInput('');
      setStarterPromptError(null);
      setStarterPromptState('idle');
    },
    [queryClient],
  );

  const saveContent = useCallback(
    async (nextContent: string): Promise<void> => {
      setSaveState('saving');
      setSaveError(null);

      try {
        const savedWriting = await saveWritingAttempt({
          templateId: selectedTemplateId,
          content: nextContent,
          userGoal,
        });
        lastSavedContentRef.current = savedWriting.activeRevision?.content ?? nextContent;
        if (savedWriting.staleReview) {
          setReviewPreview(null);
          setLatestReviewRun(null);
        }
        setSaveState('saved');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Autosave failed.';
        setSaveError(message);
        setSaveState('error');
      }
    },
    [saveWritingAttempt, selectedTemplateId, userGoal],
  );

  useEffect(() => {
    if (content === lastSavedContentRef.current) {
      return;
    }

    setSaveState('idle');
    const timeoutId = window.setTimeout(() => {
      void saveContent(content);
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [content, saveContent, userGoal]);

  const startReviewForWriting = useCallback(
    async (targetWriting: WritingAttemptSnapshot): Promise<void> => {
      if (!targetWriting.activeRevision) {
        setReviewState('failed');
        setReviewError('Save your writing before review.');
        return;
      }

      activeReviewRef.current = true;
      setReviewState('reviewing');
      setReviewError(null);
      setReviewProgress(emptyReviewProgress());
      setLatestReviewRun(null);
      setReviewPreview(null);
      setSelfRepairAttempt('');
      setModelAnswerRevealed(false);

      try {
        const result = await startReview({
          templateId: targetWriting.templateId,
          writingAttemptId: targetWriting.attemptId,
          writingRevisionId: targetWriting.activeRevision.id,
        });

        activeReviewRef.current = false;

        if (result.disclosureRequired) {
          setShowDisclosure(true);
          setReviewState('idle');
          return;
        }

        if (result.reviewRun) {
          setLatestReviewRun(result.reviewRun);
          setReviewProgress((current) => ({
            ...current,
            activeRunId: result.reviewRun?.id ?? current.activeRunId,
          }));
        }

        if (result.success === true && result.reviewRun) {
          const reviewRun = result.reviewRun;
          const preview: ReviewPreviewSnapshot | null =
            result.preview ??
            (await queryClient.fetchQuery({
              queryKey: queryKeys.review.preview(reviewRun.id),
              queryFn: () => window.api.review.getPreview({ reviewRunId: reviewRun.id }),
            }));
          setReviewPreviewCache(queryClient, { reviewRunId: reviewRun.id }, preview);
          setReviewPreview(preview);
          setReviewState(preview ? 'ready' : 'failed');
          await queryClient.invalidateQueries({ queryKey: queryKeys.writing.attempt(targetWriting.templateId) });
          if (!preview) {
            setReviewError('Review preview is unavailable.');
          }
          return;
        }

        setReviewState('failed');
        setReviewError(result.error ?? 'Review failed.');
      } catch (error) {
        activeReviewRef.current = false;
        throw error;
      }
    },
    [queryClient, startReview],
  );

  const reviewCurrentContent = useCallback(async (): Promise<void> => {
    try {
      const savedWriting = await saveWritingAttempt({ templateId: selectedTemplateId, content, userGoal });
      lastSavedContentRef.current = savedWriting.activeRevision?.content ?? content;
      setSaveState('saved');
      await startReviewForWriting(savedWriting);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Review failed.';
      setReviewState('failed');
      setReviewError(message);
    }
  }, [content, saveWritingAttempt, selectedTemplateId, startReviewForWriting, userGoal]);

  const generateStarterPrompt = useCallback(async (): Promise<void> => {
    setStarterPromptState('generating');
    setStarterPromptError(null);
    const result = await generateStarterPromptMutation({ templateId: selectedTemplateId, userGoal });

    if (result.disclosureRequired) {
      setStarterPromptState('idle');
      setShowStarterDisclosure(true);
      return;
    }

    if (result.success && result.writing) {
      updateWritingCache(result.writing);
      setUserGoal(result.writing.userGoal ?? userGoal);
      setStarterPromptState('idle');
      return;
    }

    setStarterPromptState('error');
    setStarterPromptError(result.error ?? 'Starter prompt generation failed.');
  }, [generateStarterPromptMutation, selectedTemplateId, updateWritingCache, userGoal]);

  const acknowledgeStarterDisclosureAndGenerate = useCallback(async (): Promise<void> => {
    await window.api.writing.acknowledgeStarterPromptDisclosure({ acknowledged: true });
    setShowStarterDisclosure(false);
    await generateStarterPrompt();
  }, [generateStarterPrompt]);

  const skipStarterPrompt = useCallback((): void => {
    setStarterPromptError(null);
    setStarterPromptState('idle');
  }, []);

  const saveReview = useCallback(async (): Promise<void> => {
    if (!reviewPreview) {
      return;
    }

    setReviewState('saving');
    setReviewError(null);
    const result = await saveReviewMutation({
      reviewRunId: reviewPreview.reviewRun.id,
      selfRepairAttemptText: selfRepairAttempt,
      revealedWithoutAttempt: modelAnswerRevealed,
    });

    if (result.success && result.writing) {
      updateWritingCache(result.writing);
      setReviewState('saved');
      return;
    }

    setReviewState('failed');
    setReviewError(result.error ?? 'Unable to save review.');
  }, [modelAnswerRevealed, reviewPreview, saveReviewMutation, selfRepairAttempt, updateWritingCache]);

  const completePendingRewritePractice = useCallback(async (): Promise<void> => {
    if (!writing.pendingRewritePractice) {
      return;
    }

    setRewritePracticeError(null);
    const result = await completeRewritePracticeMutation({
      rewriteTaskId: writing.pendingRewritePractice.id,
      userRewriteText: rewritePracticeInput,
    });

    if (result.success && result.writing && result.rewritePractice) {
      updateWritingCache(result.writing);
      setCompletedRewritePractice(result.rewritePractice);
      setRewritePracticeInput(result.rewritePractice.userRewriteText ?? rewritePracticeInput.trim());
      return;
    }

    setRewritePracticeError(result.error ?? 'Unable to complete rewrite practice.');
  }, [completeRewritePracticeMutation, updateWritingCache, writing.pendingRewritePractice, rewritePracticeInput]);

  const skipPendingRewritePractice = useCallback(async (): Promise<void> => {
    if (!writing.pendingRewritePractice) {
      return;
    }

    setRewritePracticeError(null);
    const result = await skipRewritePracticeMutation({ rewriteTaskId: writing.pendingRewritePractice.id });

    if (result.success && result.writing) {
      updateWritingCache(result.writing);
      setCompletedRewritePractice(null);
      setRewritePracticeInput('');
      return;
    }

    setRewritePracticeError(result.error ?? 'Unable to skip rewrite practice.');
  }, [skipRewritePracticeMutation, updateWritingCache, writing.pendingRewritePractice]);

  const acknowledgeDisclosureAndReview = useCallback(async (): Promise<void> => {
    await window.api.review.acknowledgeDisclosure({ acknowledged: true });
    setShowDisclosure(false);
    await reviewCurrentContent();
  }, [reviewCurrentContent]);

  const setDefaultProvider = useCallback(
    async (providerId: AiProviderId): Promise<void> => {
      setSettingsError(null);
      setSettingsMessage(null);
      try {
        await setDefaultProviderMutation({ providerId });
        setSettingsMessage('Default provider updated.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update default provider.';
        setSettingsError(message);
      }
    },
    [setDefaultProviderMutation],
  );

  const saveOpenAiProviderConfig = useCallback(async (): Promise<void> => {
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const updatedSettings = await setProviderConfigMutation({
        providerId: 'openai-compatible',
        baseUrl: openAiBaseUrlInput,
        model: openAiModelInput,
      });
      setOpenAiBaseUrlInput(
        updatedSettings.aiModelSettings?.providers['openai-compatible'].baseUrl ?? updatedSettings.baseUrl,
      );
      setOpenAiModelInput(
        updatedSettings.aiModelSettings?.providers['openai-compatible'].model ?? updatedSettings.model,
      );
      setSettingsMessage('OpenAI-compatible settings saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save OpenAI-compatible settings.';
      setSettingsError(message);
    }
  }, [openAiBaseUrlInput, openAiModelInput, setProviderConfigMutation]);

  const saveAnthropicProviderConfig = useCallback(async (): Promise<void> => {
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const updatedSettings = await setProviderConfigMutation({ providerId: 'anthropic', model: anthropicModelInput });
      setAnthropicModelInput(updatedSettings.aiModelSettings?.providers.anthropic.model ?? updatedSettings.model);
      setSettingsMessage('Anthropic settings saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save Anthropic settings.';
      setSettingsError(message);
    }
  }, [anthropicModelInput, setProviderConfigMutation]);

  const updateProviderApiKeyInput = useCallback((providerId: AiProviderId, value: string): void => {
    setProviderApiKeyInputs((current) => ({ ...current, [providerId]: value }));
  }, []);

  const saveProviderApiKey = useCallback(
    async (providerId: AiProviderId): Promise<void> => {
      setSettingsError(null);
      setSettingsMessage(null);
      const result = await setProviderApiKeyMutation({ providerId, apiKey: providerApiKeyInputs[providerId] });
      if (result.success && result.status) {
        setProviderApiKeyInputs((current) => ({ ...current, [providerId]: '' }));
        setSettingsMessage('Provider API key saved to the OS keychain.');
        return;
      }
      setSettingsError(result.error ?? 'Unable to save provider API key.');
    },
    [providerApiKeyInputs, setProviderApiKeyMutation],
  );

  const deleteProviderKey = useCallback(
    async (providerId: AiProviderId): Promise<void> => {
      setSettingsError(null);
      setSettingsMessage(null);
      const result = await deleteProviderApiKeyMutation({ providerId });
      if (result.success && result.status) {
        setSettingsMessage('Provider API key deleted.');
        return;
      }
      setSettingsError(result.error ?? 'Unable to delete provider API key.');
    },
    [deleteProviderApiKeyMutation],
  );

  const toggleRawResponseStorage = useCallback(
    async (enabled: boolean): Promise<void> => {
      await setRawResponseStorageMutation({ enabled });
    },
    [setRawResponseStorageMutation],
  );

  const requestRevealModelAnswer = useCallback((): void => {
    if (modelAnswerRevealed || selfRepairAttempt.trim().length > 0) {
      setModelAnswerRevealed(true);
      return;
    }

    setShowRevealConfirmation(true);
  }, [modelAnswerRevealed, selfRepairAttempt]);

  const revealModelAnswerAfterConfirmation = useCallback((): void => {
    setShowRevealConfirmation(false);
    setModelAnswerRevealed(true);
  }, []);

  return (
    <main className="app-orb-field min-h-screen overflow-hidden bg-base-200 p-4 text-base-content md:p-6">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[96rem] flex-col gap-4 md:h-[calc(100vh-3rem)]">
        <PracticeHeader
          selectedTemplateTitle={writing.template.title}
          startup={startup}
          status={appStatus}
          onOpenSettings={() => setShowSettingsDrawer(true)}
        />

        <PracticeTemplatePicker
          templates={WRITING_TEMPLATES}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={(templateId) => {
            void selectTemplate(templateId);
          }}
        />

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
          <WritingEditorCard
            template={writing.template}
            generatedPrompt={writing.generatedPrompt}
            userGoal={userGoal}
            starterPromptState={starterPromptState}
            starterPromptError={starterPromptError}
            content={content}
            lastAutosaveAt={writing.lastAutosaveAt}
            saveState={saveState}
            saveError={saveError}
            highlightedContent={highlightedContent}
            highlightedCorrections={highlightedCorrections}
            onContentChange={setContent}
            onUserGoalChange={setUserGoal}
            onGenerateStarterPrompt={() => {
              void generateStarterPrompt();
            }}
            onSkipStarterPrompt={skipStarterPrompt}
          />
          <LearningPanel
            writing={writing}
            hasWritten={hasWritten}
            saveState={saveState}
            reviewState={reviewState}
            reviewError={reviewError}
            reviewProgress={reviewProgress}
            latestReviewRun={latestReviewRun}
            preview={reviewPreview}
            selfRepairAttempt={selfRepairAttempt}
            modelAnswerRevealed={modelAnswerRevealed}
            onSelfRepairAttemptChange={setSelfRepairAttempt}
            onRevealModelAnswer={requestRevealModelAnswer}
            onSaveReview={() => {
              void saveReview();
            }}
            rewritePracticeInput={rewritePracticeInput}
            completedRewritePractice={completedRewritePractice}
            rewritePracticeError={rewritePracticeError}
            onRewritePracticeInputChange={(value) => {
              setRewritePracticeInput(value);
              setCompletedRewritePractice(null);
            }}
            onCompleteRewritePractice={() => {
              void completePendingRewritePractice();
            }}
            onSkipRewritePractice={() => {
              void skipPendingRewritePractice();
            }}
            onReviewCurrentVersion={() => {
              void reviewCurrentContent();
            }}
          />
        </div>
      </div>

      <SettingsDrawer
        isOpen={showSettingsDrawer}
        settings={appSettings}
        startup={startup}
        openAiBaseUrlInput={openAiBaseUrlInput}
        openAiModelInput={openAiModelInput}
        anthropicModelInput={anthropicModelInput}
        apiKeyInputs={providerApiKeyInputs}
        message={settingsMessage}
        error={settingsError}
        onClose={() => setShowSettingsDrawer(false)}
        onDefaultProviderChange={(providerId) => {
          void setDefaultProvider(providerId);
        }}
        onOpenAiBaseUrlChange={setOpenAiBaseUrlInput}
        onOpenAiModelChange={setOpenAiModelInput}
        onAnthropicModelChange={setAnthropicModelInput}
        onApiKeyChange={updateProviderApiKeyInput}
        onSaveOpenAiConfig={() => {
          void saveOpenAiProviderConfig();
        }}
        onSaveAnthropicConfig={() => {
          void saveAnthropicProviderConfig();
        }}
        onSaveApiKey={(providerId) => {
          void saveProviderApiKey(providerId);
        }}
        onDeleteApiKey={(providerId) => {
          void deleteProviderKey(providerId);
        }}
        onRawResponseStorageChange={(enabled) => {
          void toggleRawResponseStorage(enabled);
        }}
      />

      <RevealAnswerDialog
        isOpen={showRevealConfirmation}
        onCancel={() => setShowRevealConfirmation(false)}
        onReveal={revealModelAnswerAfterConfirmation}
      />

      {showDisclosure ? (
        <ReviewDisclosureDialog
          settings={appSettings}
          mode="review"
          onCancel={() => setShowDisclosure(false)}
          onAcknowledge={() => {
            void acknowledgeDisclosureAndReview();
          }}
        />
      ) : null}

      {showStarterDisclosure ? (
        <ReviewDisclosureDialog
          settings={appSettings}
          mode="starter"
          onCancel={() => setShowStarterDisclosure(false)}
          onAcknowledge={() => {
            void acknowledgeStarterDisclosureAndGenerate();
          }}
        />
      ) : null}
    </main>
  );
}

function getAppStatus(startup: StartupStatus, settings: SettingsSnapshot): AppStatusModel {
  const defaultKeyStatus =
    settings.providerCredentialStatuses?.[settings.providerId ?? 'openai-compatible'].status ??
    settings.providerApiKeyStatus;

  if (!startup.databaseReady || !startup.migrationsApplied || defaultKeyStatus === 'unavailable') {
    return {
      readiness: 'error',
      label: 'Error',
      toneClassName: 'badge-error badge-soft',
      detail: !startup.databaseReady ? 'Database unavailable' : 'Keychain unavailable',
    };
  }

  if (defaultKeyStatus !== 'configured') {
    return {
      readiness: 'setup-needed',
      label: 'Setup needed',
      toneClassName: 'badge-warning badge-soft',
      detail: 'Add an API key before review',
    };
  }

  return {
    readiness: 'ready',
    label: 'Ready',
    toneClassName: 'badge-success badge-soft',
    detail: 'AI is configured',
  };
}
