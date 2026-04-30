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
import { SettingsPage } from './components/SettingsPage';
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

type AppArea = 'today' | 'write' | 'library' | 'settings';

const APP_NAV_ITEMS: { id: AppArea; label: string; shortLabel: string }[] = [
  { id: 'today', label: 'Today', shortLabel: 'Today' },
  { id: 'write', label: 'Write / Practice', shortLabel: 'Write' },
  { id: 'library', label: 'Library', shortLabel: 'Library' },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings' },
];

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
        <div className="rounded-xl border border-base-300 bg-base-100 p-8 text-center shadow-xl">
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
  const [activeArea, setActiveArea] = useState<AppArea>('today');
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
  const lastSavedUserGoalRef = useRef(initialWriting.userGoal ?? '');
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
      lastSavedUserGoalRef.current = nextWriting.userGoal ?? '';
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
        lastSavedUserGoalRef.current = savedWriting.userGoal ?? userGoal;
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
    if (content === lastSavedContentRef.current && userGoal === lastSavedUserGoalRef.current) {
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
      lastSavedUserGoalRef.current = savedWriting.userGoal ?? userGoal;
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
    if (content !== lastSavedContentRef.current || userGoal !== lastSavedUserGoalRef.current) {
      const savedWriting = await saveWritingAttempt({ templateId: selectedTemplateId, content, userGoal });
      lastSavedContentRef.current = savedWriting.activeRevision?.content ?? content;
      lastSavedUserGoalRef.current = savedWriting.userGoal ?? userGoal;
      setSaveState('saved');
    }

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
  }, [content, generateStarterPromptMutation, saveWritingAttempt, selectedTemplateId, updateWritingCache, userGoal]);

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
    <main className="min-h-screen overflow-hidden bg-base-200 text-base-content">
      <div className="grid h-screen grid-cols-[4.75rem_minmax(0,1fr)]">
        <nav
          className="flex flex-col items-center border-r border-base-300/70 bg-base-100/90 py-4"
          aria-label="App areas"
        >
          <div className="mb-6 grid size-10 place-items-center rounded-xl bg-neutral text-sm font-semibold text-neutral-content">
            EC
          </div>
          <div className="flex flex-1 flex-col items-center gap-2">
            {APP_NAV_ITEMS.map((item) => {
              const isActive = activeArea === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`w-16 rounded-xl px-2 py-3 text-xs font-medium transition ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-base-content/55 hover:bg-base-200 hover:text-base-content'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  onClick={() => setActiveArea(item.id)}
                >
                  {item.shortLabel}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="scrollable min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
          <div className="mx-auto flex min-h-screen max-w-[92rem] flex-col px-8 py-7">
            {activeArea === 'today' ? (
              <section className="flex min-h-0 flex-1 flex-col gap-8" aria-labelledby="today-page-title">
                <div className="border-b border-base-300/60 pb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Today</p>
                  <h1 id="today-page-title" className="mt-3 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
                    Start today's writing practice
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-base-content/60 md:text-base">
                    Pick a scenario, continue your current draft, or handle one follow-up rewrite before writing.
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
                  <PracticeTemplatePicker
                    templates={WRITING_TEMPLATES}
                    selectedTemplateId={selectedTemplateId}
                    onSelectTemplate={(templateId) => {
                      void selectTemplate(templateId).then(() => setActiveArea('write'));
                    }}
                  />

                  <aside className="rounded-xl border border-base-300/70 bg-base-100 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
                      Current work
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{writing.template.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-base-content/60">{writing.template.description}</p>
                    <dl className="mt-5 grid gap-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/40">
                          Draft
                        </dt>
                        <dd className="mt-1 text-base-content/75">
                          {hasWritten ? 'Draft in progress' : 'Blank and ready'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/40">
                          Coach
                        </dt>
                        <dd className="mt-1 text-base-content/75">
                          {writing.pendingRewritePractice ? 'Follow-up rewrite available' : appStatus.detail}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-6 flex flex-col gap-2">
                      <button
                        type="button"
                        className="btn btn-neutral rounded-xl"
                        onClick={() => setActiveArea('write')}
                      >
                        {hasWritten ? 'Continue writing' : 'Start writing'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost rounded-xl"
                        onClick={() => setActiveArea('settings')}
                      >
                        Configure AI provider
                      </button>
                    </div>
                  </aside>
                </div>
              </section>
            ) : null}

            {activeArea === 'write' ? (
              <section className="flex min-h-0 flex-1 flex-col gap-5">
                <PracticeHeader selectedTemplateTitle={writing.template.title} startup={startup} status={appStatus} />
                <div className="flex flex-wrap items-center gap-3 text-sm text-base-content/60">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Status</span>
                  <span>Draft</span>
                  <span aria-hidden="true">/</span>
                  <span>Coach feedback</span>
                  <span aria-hidden="true">/</span>
                  <span>Try again</span>
                  <span aria-hidden="true">/</span>
                  <span>Follow-up rewrite</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-base-content/60">
                  <span className="font-medium text-base-content/75">Current template:</span>
                  {WRITING_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={`rounded-full px-3 py-1 transition ${
                        template.id === selectedTemplateId
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-base-100 hover:text-base-content'
                      }`}
                      onClick={() => {
                        void selectTemplate(template.id);
                      }}
                    >
                      {template.title}
                    </button>
                  ))}
                </div>

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
              </section>
            ) : null}

            {activeArea === 'library' ? (
              <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="library-page-title">
                <div className="border-b border-base-300/60 pb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Library</p>
                  <h1 id="library-page-title" className="mt-3 text-4xl font-semibold tracking-[-0.05em]">
                    Practice history
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-base-content/60">
                    A calm entry point for saved sessions. This first version keeps the focus on current practice.
                  </p>
                </div>
                <div className="mt-8 max-w-2xl rounded-xl border border-base-300/70 bg-base-100 p-5">
                  <h2 className="text-xl font-semibold tracking-[-0.03em]">Recent current session</h2>
                  <p className="mt-2 text-sm leading-6 text-base-content/60">
                    {writing.lastReviewRunId
                      ? 'Your latest saved feedback is available from the Write area for the current template.'
                      : 'No saved review is exposed here yet. Write and save Coach feedback to build history.'}
                  </p>
                  <button
                    type="button"
                    className="btn btn-neutral mt-5 rounded-xl"
                    onClick={() => setActiveArea('write')}
                  >
                    Open current practice
                  </button>
                </div>
              </section>
            ) : null}

            {activeArea === 'settings' ? (
              <SettingsPage
                settings={appSettings}
                startup={startup}
                openAiBaseUrlInput={openAiBaseUrlInput}
                openAiModelInput={openAiModelInput}
                anthropicModelInput={anthropicModelInput}
                apiKeyInputs={providerApiKeyInputs}
                message={settingsMessage}
                error={settingsError}
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
            ) : null}
          </div>
        </div>
      </div>

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
