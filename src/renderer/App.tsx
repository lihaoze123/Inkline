import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { StartupStatus } from '@shared/types/app';
import type { WritingAttemptSnapshot, WritingTemplateId } from '@shared/types/writing';
import { WRITING_TEMPLATES } from '@shared/writing/templates';
import type { ReviewPreviewSnapshot, ReviewProgressEvent, ReviewRunSnapshot } from '@shared/types/review';
import type { AiProviderId } from '@shared/types/credentials';
import {
  CURRENT_ONBOARDING_INTRO_VERSION,
  type SettingsSnapshot,
  type SetProviderConfigInput,
} from '@shared/types/settings';
import type { ErrorPatternSnapshot, NotebookEntrySnapshot } from '@shared/types/learning-assets';
import { WritingEditorCard } from './components/WritingEditorCard';
import { LearningPanel } from './components/LearningPanel';
import { RevealAnswerDialog } from './components/RevealAnswerDialog';
import { ReviewDisclosureDialog } from './components/ReviewDisclosureDialog';
import { SettingsPage } from './components/SettingsPage';
import { OnboardingIntro } from './components/OnboardingIntro';
import { PracticeHeader } from './components/PracticeHeader';
import { getFocusCorrection, HighlightedWriting, patternRule } from './components/review-utils';
import feedbackInkLandscapeUrl from './assets/feedback-ink-landscape.png';
import type { ReviewProgressModel, ReviewState, SaveState } from './components/types';
import { useFoundationState } from './query/foundation';
import { queryKeys } from './query/keys';
import { useErrorPatterns, useNotebookEntries } from './query/learning-assets';
import { setReviewPreviewCache, useSaveReview, useStartReview } from './query/review';
import {
  useDeleteProviderApiKey,
  useSetDefaultProvider,
  useSetOnboardingIntroVersionSeen,
  useSetProviderApiKey,
  useSetProviderConfig,
  useSetRawResponseStorage,
  useSetReviewThinking,
  useSettingsSnapshot,
} from './query/settings';
import {
  updateWritingAttemptCache,
  useCompleteRewritePractice,
  useGenerateStarterPrompt,
  useRetryRewriteCheck,
  useSaveWritingAttempt,
  useSkipRewritePractice,
  useSnoozeRewritePractice,
  useWritingAttempt,
} from './query/writing';

const AUTOSAVE_DELAY_MS = 900;
const MINUTES_PER_DAY = 24 * 60;
const MS_PER_MINUTE = 60_000;

type AppArea = 'today' | 'write' | 'feedback' | 'notebook' | 'progress' | 'settings';
type NavIconName = 'home' | 'pen' | 'book' | 'bars' | 'settings';

const APP_NAV_ITEMS: { id: AppArea; label: string; icon: NavIconName; isHidden?: boolean }[] = [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'write', label: 'Practice', icon: 'pen' },
  { id: 'feedback', label: 'Practice', icon: 'pen', isHidden: true },
  { id: 'notebook', label: 'Notebook', icon: 'book' },
  { id: 'progress', label: 'Progress', icon: 'bars' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function emptyReviewProgress(): ReviewProgressModel {
  return {
    activeRunId: null,
    events: [],
    currentEvent: null,
    startedAt: null,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function emptyProviderTextInputMap(): Record<AiProviderId, string> {
  return {
    openai: '',
    deepseek: '',
    anthropic: '',
    google: '',
    xai: '',
    openrouter: '',
    'openai-compatible': '',
  };
}

function getProviderModelInputs(settings: SettingsSnapshot): Record<AiProviderId, string> {
  const providers = settings.aiModelSettings?.providers;
  return {
    openai: providers?.openai.model ?? (settings.providerId === 'openai' ? settings.model : ''),
    deepseek: providers?.deepseek.model ?? (settings.providerId === 'deepseek' ? settings.model : ''),
    anthropic: providers?.anthropic.model ?? (settings.providerId === 'anthropic' ? settings.model : ''),
    google: providers?.google.model ?? (settings.providerId === 'google' ? settings.model : ''),
    xai: providers?.xai.model ?? (settings.providerId === 'xai' ? settings.model : ''),
    openrouter: providers?.openrouter.model ?? (settings.providerId === 'openrouter' ? settings.model : ''),
    'openai-compatible':
      providers?.['openai-compatible'].model ??
      (!settings.providerId || settings.providerId === 'openai-compatible' ? settings.model : ''),
  };
}

function getOpenAiCompatibleBaseUrlInput(settings: SettingsSnapshot): string {
  return settings.aiModelSettings?.providers['openai-compatible'].baseUrl ?? settings.baseUrl;
}

function buildProviderConfigInput(providerId: AiProviderId, baseUrl: string, model: string): SetProviderConfigInput {
  if (providerId === 'openai-compatible') {
    return {
      providerId,
      baseUrl,
      model,
    };
  }

  return {
    providerId,
    model,
  };
}

function providerLabel(providerId: AiProviderId): string {
  switch (providerId) {
    case 'openai':
      return 'OpenAI';
    case 'deepseek':
      return 'DeepSeek';
    case 'anthropic':
      return 'Anthropic';
    case 'google':
      return 'Google Gemini';
    case 'xai':
      return 'xAI Grok';
    case 'openrouter':
      return 'OpenRouter';
    case 'openai-compatible':
      return 'Custom OpenAI-compatible';
  }
}

export function App(): React.JSX.Element {
  const foundationState = useFoundationState();

  if (foundationState.status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-base-200 p-8 text-base-content">
        <section className="paper-sheet ui-chrome max-w-md px-8 py-7 text-center">
          <span className="loading loading-spinner loading-md text-primary" />
          <p className="mt-4 font-medium text-base-content/68">Opening Inkline...</p>
        </section>
      </main>
    );
  }

  if (foundationState.status === 'error') {
    return (
      <main className="grid min-h-screen place-items-center bg-base-200 p-8 text-base-content">
        <section className="paper-sheet max-w-lg p-7">
          <h1 className="editorial-heading text-3xl text-base-content">Inkline could not open</h1>
          <p className="selectable-content mt-4 text-sm leading-6 text-error/85">{foundationState.message}</p>
        </section>
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
  const { mutateAsync: completeRewritePracticeMutation, isPending: isCompleteRewritePracticePending } =
    useCompleteRewritePractice();
  const { mutateAsync: retryRewriteCheckMutation, isPending: isRetryRewriteCheckPending } = useRetryRewriteCheck();
  const { mutateAsync: skipRewritePracticeMutation } = useSkipRewritePractice();
  const { mutateAsync: snoozeRewritePracticeMutation } = useSnoozeRewritePractice();
  const { mutateAsync: setDefaultProviderMutation } = useSetDefaultProvider();
  const { mutateAsync: setOnboardingIntroVersionSeenMutation, isPending: isOnboardingIntroDismissPending } =
    useSetOnboardingIntroVersionSeen();
  const { mutateAsync: setProviderConfigMutation } = useSetProviderConfig();
  const { mutateAsync: setProviderApiKeyMutation } = useSetProviderApiKey();
  const { mutateAsync: deleteProviderApiKeyMutation } = useDeleteProviderApiKey();
  const { mutateAsync: setRawResponseStorageMutation } = useSetRawResponseStorage();
  const { mutateAsync: setReviewThinkingMutation } = useSetReviewThinking();
  const writing = writingQuery.data ?? initialWriting;
  const [content, setContent] = useState(initialWriting.activeRevision?.content ?? '');
  const [userGoal, setUserGoal] = useState(initialWriting.userGoal ?? '');
  const [starterPromptState, setStarterPromptState] = useState<'idle' | 'generating' | 'error'>('idle');
  const [starterPromptError, setStarterPromptError] = useState<string | null>(null);
  const [isStarterPromptVisible, setIsStarterPromptVisible] = useState(true);
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
  const errorPatternsQuery = useErrorPatterns({ enabled: activeArea === 'progress' });
  const notebookEntriesQuery = useNotebookEntries({ enabled: activeArea === 'notebook' });
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [showRevealConfirmation, setShowRevealConfirmation] = useState(false);
  const [openAiCompatibleBaseUrlInput, setOpenAiCompatibleBaseUrlInput] = useState(() =>
    getOpenAiCompatibleBaseUrlInput(settings),
  );
  const [providerModelInputs, setProviderModelInputs] = useState<Record<AiProviderId, string>>(() =>
    getProviderModelInputs(settings),
  );
  const [providerApiKeyInputs, setProviderApiKeyInputs] = useState<Record<AiProviderId, string>>(() =>
    emptyProviderTextInputMap(),
  );
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isWelcomeIntroReplayOpen, setIsWelcomeIntroReplayOpen] = useState(false);
  const [isWelcomeIntroLocallyDismissed, setIsWelcomeIntroLocallyDismissed] = useState(false);
  const [welcomeIntroError, setWelcomeIntroError] = useState<string | null>(null);
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
  const practicePromptTitle = getPracticePromptTitle(writing);
  const todayGreeting = getTodayGreeting(getHourWithOffset(currentTimeMs, startup.timeZoneOffsetMinutes));
  const shouldShowFirstLaunchIntro =
    appSettings.onboardingIntroVersionSeen < CURRENT_ONBOARDING_INTRO_VERSION && !isWelcomeIntroLocallyDismissed;
  const isWelcomeIntroOpen = shouldShowFirstLaunchIntro || isWelcomeIntroReplayOpen;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

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
      if (content !== lastSavedContentRef.current || userGoal !== lastSavedUserGoalRef.current) {
        const savedWriting = await saveWritingAttempt({ templateId: selectedTemplateId, content, userGoal });
        updateWritingCache(savedWriting);
        lastSavedContentRef.current = savedWriting.activeRevision?.content ?? content;
        lastSavedUserGoalRef.current = savedWriting.userGoal ?? userGoal;
        setSaveState('saved');
      }

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
      setIsStarterPromptVisible(true);
    },
    [content, queryClient, saveWritingAttempt, selectedTemplateId, updateWritingCache, userGoal],
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
        setReviewState('failed');
        setReviewError(getErrorMessage(error, 'Review failed.'));
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

    try {
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
        setIsStarterPromptVisible(true);
        return;
      }

      setStarterPromptState('error');
      setStarterPromptError(result.error ?? 'Starter prompt generation failed.');
    } catch (error) {
      setStarterPromptState('error');
      setStarterPromptError(getErrorMessage(error, 'Starter prompt generation failed.'));
    }
  }, [content, generateStarterPromptMutation, saveWritingAttempt, selectedTemplateId, updateWritingCache, userGoal]);

  const acknowledgeStarterDisclosureAndGenerate = useCallback(async (): Promise<void> => {
    setStarterPromptError(null);
    try {
      await window.api.writing.acknowledgeStarterPromptDisclosure({ acknowledged: true });
      setShowStarterDisclosure(false);
      await generateStarterPrompt();
    } catch (error) {
      setShowStarterDisclosure(false);
      setStarterPromptState('error');
      setStarterPromptError(getErrorMessage(error, 'Starter prompt generation failed.'));
    }
  }, [generateStarterPrompt]);

  const skipStarterPrompt = useCallback((): void => {
    setStarterPromptError(null);
    setStarterPromptState('idle');
    setIsStarterPromptVisible(false);
  }, []);

  const saveReview = useCallback(async (): Promise<void> => {
    if (!reviewPreview) {
      return;
    }

    setReviewState('saving');
    setReviewError(null);

    try {
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
    } catch (error) {
      setReviewState('failed');
      setReviewError(getErrorMessage(error, 'Unable to save review.'));
    }
  }, [modelAnswerRevealed, reviewPreview, saveReviewMutation, selfRepairAttempt, updateWritingCache]);

  const completePendingRewritePractice = useCallback(async (): Promise<void> => {
    if (!writing.pendingRewritePractice) {
      return;
    }

    setRewritePracticeError(null);

    try {
      const result = await completeRewritePracticeMutation({
        rewriteTaskId: writing.pendingRewritePractice.id,
        userRewriteText: rewritePracticeInput,
      });

      if (result.success && result.rewritePractice) {
        if (result.writing) {
          updateWritingCache(result.writing);
        }
        if (result.rewritePractice.status === 'completed') {
          setCompletedRewritePractice(result.rewritePractice);
          setRewritePracticeInput(result.rewritePractice.userRewriteText ?? rewritePracticeInput.trim());
        } else {
          setCompletedRewritePractice(null);
          setRewritePracticeInput('');
        }
        return;
      }

      setRewritePracticeError(result.error ?? 'Unable to complete rewrite practice.');
    } catch (error) {
      setRewritePracticeError(getErrorMessage(error, 'Unable to complete rewrite practice.'));
    }
  }, [completeRewritePracticeMutation, updateWritingCache, writing.pendingRewritePractice, rewritePracticeInput]);

  const retryCompletedRewriteCheck = useCallback(async (): Promise<void> => {
    const rewritePractice = completedRewritePractice ?? writing.pendingRewritePractice;
    if (!rewritePractice) {
      return;
    }

    setRewritePracticeError(null);

    try {
      const result = await retryRewriteCheckMutation({ rewriteTaskId: rewritePractice.id });

      if (result.success) {
        if (result.writing) {
          updateWritingCache(result.writing);
        }

        const checkedRewritePractice =
          result.rewritePractice ??
          (result.rewriteCheck && result.rewriteCheck.rewriteTaskId === rewritePractice.id
            ? { ...rewritePractice, latestRewriteCheck: result.rewriteCheck }
            : null);

        if (checkedRewritePractice) {
          setCompletedRewritePractice(checkedRewritePractice);
          return;
        }
      }

      setRewritePracticeError(result.error ?? 'Unable to retry rewrite check.');
    } catch (error) {
      setRewritePracticeError(getErrorMessage(error, 'Unable to retry rewrite check.'));
    }
  }, [completedRewritePractice, retryRewriteCheckMutation, updateWritingCache, writing.pendingRewritePractice]);

  const skipPendingRewritePractice = useCallback(async (): Promise<void> => {
    if (!writing.pendingRewritePractice) {
      return;
    }

    setRewritePracticeError(null);

    try {
      const result = await skipRewritePracticeMutation({ rewriteTaskId: writing.pendingRewritePractice.id });

      if (result.success && result.writing) {
        updateWritingCache(result.writing);
        setCompletedRewritePractice(null);
        setRewritePracticeInput('');
        return;
      }

      setRewritePracticeError(result.error ?? 'Unable to skip rewrite practice.');
    } catch (error) {
      setRewritePracticeError(getErrorMessage(error, 'Unable to skip rewrite practice.'));
    }
  }, [skipRewritePracticeMutation, updateWritingCache, writing.pendingRewritePractice]);

  const snoozePendingRewritePractice = useCallback(async (): Promise<void> => {
    if (!writing.pendingRewritePractice) {
      return;
    }

    setRewritePracticeError(null);

    try {
      const result = await snoozeRewritePracticeMutation({ rewriteTaskId: writing.pendingRewritePractice.id });

      if (result.success && result.writing) {
        updateWritingCache(result.writing);
        setCompletedRewritePractice(null);
        setRewritePracticeInput('');
        return;
      }

      setRewritePracticeError(result.error ?? 'Unable to snooze rewrite practice.');
    } catch (error) {
      setRewritePracticeError(getErrorMessage(error, 'Unable to snooze rewrite practice.'));
    }
  }, [snoozeRewritePracticeMutation, updateWritingCache, writing.pendingRewritePractice]);

  const acknowledgeDisclosureAndReview = useCallback(async (): Promise<void> => {
    setReviewError(null);
    try {
      await window.api.review.acknowledgeDisclosure({ acknowledged: true });
      setShowDisclosure(false);
      await reviewCurrentContent();
    } catch (error) {
      setShowDisclosure(false);
      setReviewState('failed');
      setReviewError(getErrorMessage(error, 'Review failed.'));
    }
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

  const updateProviderModelInput = useCallback((providerId: AiProviderId, value: string): void => {
    setProviderModelInputs((current) => ({ ...current, [providerId]: value }));
  }, []);

  const updateProviderApiKeyInput = useCallback((providerId: AiProviderId, value: string): void => {
    setProviderApiKeyInputs((current) => ({ ...current, [providerId]: value }));
  }, []);

  const saveProviderSettings = useCallback(
    async (providerId: AiProviderId): Promise<void> => {
      const apiKey = providerApiKeyInputs[providerId].trim();
      const label = providerLabel(providerId);
      setSettingsError(null);
      setSettingsMessage(null);

      try {
        const updatedSettings = await setProviderConfigMutation(
          buildProviderConfigInput(providerId, openAiCompatibleBaseUrlInput, providerModelInputs[providerId]),
        );
        setOpenAiCompatibleBaseUrlInput(getOpenAiCompatibleBaseUrlInput(updatedSettings));
        setProviderModelInputs(getProviderModelInputs(updatedSettings));

        if (apiKey.length === 0) {
          setSettingsMessage(`${label} settings saved.`);
          return;
        }

        const result = await setProviderApiKeyMutation({ providerId, apiKey });
        if (result.success && result.status) {
          setProviderApiKeyInputs((current) => ({ ...current, [providerId]: '' }));
          setSettingsMessage(`${label} settings and API key saved.`);
          return;
        }

        setSettingsError(result.error ?? `Unable to save ${label} API key.`);
      } catch (error) {
        setSettingsError(getErrorMessage(error, `Unable to save ${label} settings.`));
      }
    },
    [
      openAiCompatibleBaseUrlInput,
      providerApiKeyInputs,
      providerModelInputs,
      setProviderApiKeyMutation,
      setProviderConfigMutation,
    ],
  );

  const deleteProviderKey = useCallback(
    async (providerId: AiProviderId): Promise<void> => {
      setSettingsError(null);
      setSettingsMessage(null);
      try {
        const result = await deleteProviderApiKeyMutation({ providerId });
        if (result.success && result.status) {
          setSettingsMessage('Provider API key deleted.');
          return;
        }
        setSettingsError(result.error ?? 'Unable to delete provider API key.');
      } catch (error) {
        setSettingsError(getErrorMessage(error, 'Unable to delete provider API key.'));
      }
    },
    [deleteProviderApiKeyMutation],
  );

  const toggleRawResponseStorage = useCallback(
    async (enabled: boolean): Promise<void> => {
      setSettingsError(null);
      setSettingsMessage(null);
      try {
        await setRawResponseStorageMutation({ enabled });
      } catch (error) {
        setSettingsError(getErrorMessage(error, 'Unable to update raw response storage.'));
      }
    },
    [setRawResponseStorageMutation],
  );

  const toggleReviewThinking = useCallback(
    async (enabled: boolean): Promise<void> => {
      setSettingsError(null);
      setSettingsMessage(null);
      try {
        await setReviewThinkingMutation({ enabled });
        setSettingsMessage(enabled ? 'Review thinking enabled.' : 'Review thinking disabled.');
      } catch (error) {
        setSettingsError(getErrorMessage(error, 'Unable to update review thinking.'));
      }
    },
    [setReviewThinkingMutation],
  );

  const dismissWelcomeIntro = useCallback(async (): Promise<void> => {
    setWelcomeIntroError(null);

    try {
      if (shouldShowFirstLaunchIntro) {
        await setOnboardingIntroVersionSeenMutation({ version: CURRENT_ONBOARDING_INTRO_VERSION });
        setIsWelcomeIntroLocallyDismissed(true);
      }

      setIsWelcomeIntroReplayOpen(false);
      setActiveArea('today');
    } catch (error) {
      setWelcomeIntroError(getErrorMessage(error, 'Unable to save welcome preference.'));
    }
  }, [setOnboardingIntroVersionSeenMutation, shouldShowFirstLaunchIntro]);

  const viewWelcomeIntro = useCallback((): void => {
    setWelcomeIntroError(null);
    setIsWelcomeIntroReplayOpen(true);
  }, []);

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
    <main className="app-chrome min-h-screen overflow-hidden text-base-content">
      <div className="app-window-drag-strip" aria-hidden="true" />
      <div className="relative grid h-screen grid-cols-[19.5rem_minmax(0,1fr)]">
        <nav
          className="quiet-sidebar relative z-10 flex flex-col overflow-hidden px-9 py-9 shadow-[inset_-1px_0_rgba(36,41,54,0.045)]"
          aria-label="App areas"
        >
          <div className="relative z-10 pl-4">
            <p className="editorial-heading text-[2rem] leading-none text-base-content">Inkline</p>
          </div>
          <div className="quiet-sidebar__nav relative z-10 flex flex-1 flex-col">
            {APP_NAV_ITEMS.filter((item) => !item.isHidden).map((item) => {
              const isActive = activeArea === item.id || (item.id === 'write' && activeArea === 'feedback');
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`quiet-sidebar__nav-item flex items-center text-left text-lg transition ${
                    isActive ? 'font-semibold text-primary' : 'text-base-content/62 hover:text-base-content'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  data-e2e={`nav-${item.id}`}
                  onClick={() => setActiveArea(item.id)}
                >
                  <span className="nav-icon quiet-sidebar__nav-icon grid place-items-center" aria-hidden="true">
                    <NavIcon name={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div
          className="scrollable relative z-10 min-h-0 overflow-x-hidden overflow-y-auto"
          style={{ scrollbarGutter: 'stable' }}
        >
          <AppInkDecoration activeArea={activeArea} />
          <div
            className={`app-content-shell relative z-10 mx-auto flex min-h-screen flex-col px-10 py-9 ${
              activeArea === 'write' || activeArea === 'feedback' ? 'max-w-[74rem] 2xl:max-w-[83rem]' : 'max-w-[69rem]'
            }`}
          >
            {activeArea === 'today' ? (
              <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="today-page-title">
                <div className="max-w-[44rem] pt-10">
                  <h1 id="today-page-title" className="editorial-heading text-5xl leading-none text-base-content">
                    {todayGreeting}
                  </h1>
                  <p className="ui-chrome mt-4 max-w-2xl text-base leading-7 text-base-content/60">
                    Pick up the current draft, or begin with one focused prompt.
                  </p>
                  <h2 className="editorial-heading mt-10 max-w-[42rem] text-[2.4rem] leading-[1.12] text-base-content">
                    {practicePromptTitle}
                  </h2>
                  <button
                    type="button"
                    className="btn btn-primary mt-7 rounded-[0.7rem] px-8 text-base shadow-[0_12px_24px_rgba(22,71,101,0.16)]"
                    data-e2e="today-start-writing"
                    onClick={() => setActiveArea('write')}
                  >
                    {hasWritten ? 'Continue Writing' : 'Start Writing'}
                  </button>
                </div>
              </section>
            ) : null}

            {activeArea === 'write' ? (
              <section className="practice-page flex min-h-0 flex-1 flex-col gap-6">
                <PracticeHeader practicePromptTitle={practicePromptTitle} />

                <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(14.5rem,16rem)] xl:grid-cols-[minmax(0,1fr)_16.5rem]">
                  <WritingEditorCard
                    template={writing.template}
                    templates={WRITING_TEMPLATES}
                    selectedTemplateId={selectedTemplateId}
                    generatedPrompt={writing.generatedPrompt}
                    userGoal={userGoal}
                    isStarterPromptVisible={isStarterPromptVisible}
                    starterPromptState={starterPromptState}
                    starterPromptError={starterPromptError}
                    content={content}
                    lastAutosaveAt={writing.lastAutosaveAt}
                    saveState={saveState}
                    saveError={saveError}
                    onSelectTemplate={(templateId) => {
                      void selectTemplate(templateId);
                    }}
                    onContentChange={setContent}
                    onUserGoalChange={setUserGoal}
                    onGenerateStarterPrompt={() => {
                      void generateStarterPrompt();
                    }}
                    onSkipStarterPrompt={skipStarterPrompt}
                  />
                  <div className="practice-page__coach-column min-h-0">
                    <LearningPanel
                      writing={writing}
                      hasWritten={hasWritten}
                      saveState={saveState}
                      reviewState={reviewState}
                      reviewError={reviewError}
                      reviewProgress={reviewProgress}
                      latestReviewRun={latestReviewRun}
                      preview={reviewPreview}
                      onOpenFeedback={() => setActiveArea('feedback')}
                      rewritePracticeInput={rewritePracticeInput}
                      completedRewritePractice={completedRewritePractice}
                      rewritePracticeError={rewritePracticeError}
                      isRewritePracticeChecking={isCompleteRewritePracticePending || isRetryRewriteCheckPending}
                      onRewritePracticeInputChange={(value) => {
                        setRewritePracticeInput(value);
                        setCompletedRewritePractice(null);
                      }}
                      onCompleteRewritePractice={() => {
                        void completePendingRewritePractice();
                      }}
                      onRetryRewriteCheck={() => {
                        void retryCompletedRewriteCheck();
                      }}
                      onSkipRewritePractice={() => {
                        void skipPendingRewritePractice();
                      }}
                      onSnoozeRewritePractice={() => {
                        void snoozePendingRewritePractice();
                      }}
                      onReviewCurrentVersion={() => {
                        void reviewCurrentContent();
                      }}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {activeArea === 'feedback' ? (
              <FeedbackRewritePage
                preview={reviewPreview}
                reviewState={reviewState}
                selfRepairAttempt={selfRepairAttempt}
                modelAnswerRevealed={modelAnswerRevealed}
                rewritePracticeInput={rewritePracticeInput}
                saveState={saveState}
                onSelfRepairAttemptChange={setSelfRepairAttempt}
                onRevealModelAnswer={requestRevealModelAnswer}
                onSaveReview={() => {
                  void saveReview();
                }}
                onBackToDraft={() => setActiveArea('write')}
                onReviewCurrentVersion={() => {
                  void reviewCurrentContent();
                }}
                onRewritePracticeInputChange={(value) => {
                  setRewritePracticeInput(value);
                  setCompletedRewritePractice(null);
                }}
              />
            ) : null}

            {activeArea === 'notebook' ? (
              <NotebookPage
                entries={notebookEntriesQuery.data ?? []}
                isLoading={notebookEntriesQuery.isLoading}
                isError={notebookEntriesQuery.isError}
                onOpenPractice={() => setActiveArea('write')}
              />
            ) : null}

            {activeArea === 'progress' ? (
              <ProgressPage
                patterns={errorPatternsQuery.data ?? []}
                isLoading={errorPatternsQuery.isLoading}
                isError={errorPatternsQuery.isError}
                hasWritten={hasWritten}
                hasPendingRewrite={Boolean(writing.pendingRewritePractice)}
                onOpenPractice={() => setActiveArea('write')}
              />
            ) : null}

            {activeArea === 'settings' ? (
              <SettingsPage
                settings={appSettings}
                startup={startup}
                openAiCompatibleBaseUrlInput={openAiCompatibleBaseUrlInput}
                providerModelInputs={providerModelInputs}
                apiKeyInputs={providerApiKeyInputs}
                message={settingsMessage}
                error={settingsError}
                onDefaultProviderChange={(providerId) => {
                  void setDefaultProvider(providerId);
                }}
                onOpenAiCompatibleBaseUrlChange={setOpenAiCompatibleBaseUrlInput}
                onProviderModelChange={updateProviderModelInput}
                onApiKeyChange={updateProviderApiKeyInput}
                onSaveProviderSettings={(providerId) => {
                  void saveProviderSettings(providerId);
                }}
                onDeleteApiKey={(providerId) => {
                  void deleteProviderKey(providerId);
                }}
                onRawResponseStorageChange={(enabled) => {
                  void toggleRawResponseStorage(enabled);
                }}
                onReviewThinkingChange={(enabled) => {
                  void toggleReviewThinking(enabled);
                }}
                onViewWelcomeIntro={viewWelcomeIntro}
              />
            ) : null}
          </div>
        </div>
      </div>

      {isWelcomeIntroOpen ? (
        <OnboardingIntro
          isDismissPending={isOnboardingIntroDismissPending}
          error={welcomeIntroError}
          onDismiss={dismissWelcomeIntro}
        />
      ) : null}

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

function getHourWithOffset(timestampMs: number, timeZoneOffsetMinutes: number): number {
  const utcMinutes = Math.floor(timestampMs / MS_PER_MINUTE);
  const localMinuteOfDay =
    (((utcMinutes + timeZoneOffsetMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return Math.floor(localMinuteOfDay / 60);
}

function getTodayGreeting(hour: number): string {
  if (hour < 5) {
    return 'Good night.';
  }

  if (hour < 12) {
    return 'Good morning.';
  }

  if (hour < 18) {
    return 'Good afternoon.';
  }

  return 'Good evening.';
}

function getPracticePromptTitle(writing: WritingAttemptSnapshot): string {
  const prompt = writing.generatedPrompt?.text.trim();
  if (prompt) {
    return prompt;
  }

  const goal = writing.userGoal?.trim();
  if (goal) {
    return goal;
  }

  if (writing.templateId === 'journal') {
    return 'Describe a real moment from today that stayed with you.';
  }

  if (writing.templateId === 'cet4') {
    return 'Write about a practical change that improves daily life.';
  }

  if (writing.templateId === 'cet6') {
    return 'Discuss how small decisions influence long-term growth.';
  }

  return 'Develop one idea in clear English.';
}

function NavIcon({ name }: { name: NavIconName }): React.JSX.Element {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24">
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
    case 'pen':
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 24 24">
          <path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4Z" />
          <path d="M5 4v12" />
        </svg>
      );
    case 'bars':
      return (
        <svg viewBox="0 0 24 24">
          <path d="M5 20V10" />
          <path d="M12 20V4" />
          <path d="M19 20v-7" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3" />
          <path d="M12 19v3" />
          <path d="m4.93 4.93 2.12 2.12" />
          <path d="m16.95 16.95 2.12 2.12" />
          <path d="M2 12h3" />
          <path d="M19 12h3" />
          <path d="m4.93 19.07 2.12-2.12" />
          <path d="m16.95 7.05 2.12-2.12" />
        </svg>
      );
  }
}

function NotebookPage({
  entries,
  isLoading,
  isError,
  onOpenPractice,
}: {
  entries: NotebookEntrySnapshot[];
  isLoading: boolean;
  isError: boolean;
  onOpenPractice: () => void;
}): React.JSX.Element {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-9" aria-labelledby="notebook-page-title">
      <header className="ui-chrome pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Notebook</p>
        <h1 id="notebook-page-title" className="editorial-heading mt-4 text-5xl text-base-content">
          Useful expressions
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-base-content/60">
          Phrases saved from real reviews, ready to reuse in later writing.
        </p>
      </header>

      <LearningPageState
        isLoading={isLoading}
        isError={isError}
        isEmpty={entries.length === 0}
        emptyTitle="No saved expressions yet"
        emptyBody="Save a reviewed draft with useful alternatives. They will collect here for reuse."
        onOpenPractice={onOpenPractice}
      >
        <div className="selectable-content grid max-w-4xl gap-4">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-lg bg-base-100/32 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
            >
              <div className="ui-chrome flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45">
                <span>{formatDateKeyLabel(entry.dateKey)}</span>
                <span>{templateTitleFor(entry.templateId)}</span>
              </div>
              <p className="ui-chrome mt-4 text-sm leading-6 text-base-content/55">Source phrase</p>
              <p className="mt-1 text-base leading-7 text-base-content">{entry.sourceText}</p>
              <div className="mt-4 grid gap-2">
                {entry.suggestedAlternatives.map((alternative) => (
                  <p
                    key={alternative}
                    className="rounded-md bg-primary/[0.045] px-4 py-2 text-base leading-7 text-primary/90"
                  >
                    {alternative}
                  </p>
                ))}
              </div>
              {entry.reason ? <p className="mt-4 text-sm leading-6 text-base-content/62">{entry.reason}</p> : null}
            </article>
          ))}
        </div>
      </LearningPageState>
    </section>
  );
}

function ProgressPage({
  patterns,
  isLoading,
  isError,
  hasWritten,
  hasPendingRewrite,
  onOpenPractice,
}: {
  patterns: ErrorPatternSnapshot[];
  isLoading: boolean;
  isError: boolean;
  hasWritten: boolean;
  hasPendingRewrite: boolean;
  onOpenPractice: () => void;
}): React.JSX.Element {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-9" aria-labelledby="progress-page-title">
      <header className="ui-chrome pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Progress</p>
        <h1 id="progress-page-title" className="editorial-heading mt-4 text-5xl text-base-content">
          Pattern evidence
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-base-content/60">
          A calm record of patterns that have appeared in saved reviews and later rewrite practice.
        </p>
      </header>

      <div className="ui-chrome grid max-w-4xl gap-5 md:grid-cols-3">
        <section className="rounded-lg bg-base-100/24 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Current draft</p>
          <p className="mt-3 text-2xl font-semibold">{hasWritten ? 'In progress' : 'Ready'}</p>
          <p className="mt-3 text-sm leading-6 text-base-content/60">The active template keeps the session focused.</p>
        </section>
        <section className="rounded-lg bg-base-100/24 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Next rewrite</p>
          <p className="mt-3 text-2xl font-semibold">{hasPendingRewrite ? 'Waiting' : 'After review'}</p>
          <p className="mt-3 text-sm leading-6 text-base-content/60">A short repair appears after saved feedback.</p>
        </section>
        <section className="rounded-lg bg-base-100/24 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Patterns</p>
          <p className="mt-3 text-2xl font-semibold">{patterns.length}</p>
          <p className="mt-3 text-sm leading-6 text-base-content/60">Tracked patterns guide future review focus.</p>
        </section>
      </div>

      <LearningPageState
        isLoading={isLoading}
        isError={isError}
        isEmpty={patterns.length === 0}
        emptyTitle="No recurring patterns yet"
        emptyBody="Save a review and repeated grammar or wording patterns will collect here."
        onOpenPractice={onOpenPractice}
      >
        <div className="grid max-w-5xl gap-4 xl:grid-cols-2">
          {patterns.map((pattern) => (
            <article
              key={pattern.id}
              className="rounded-lg bg-base-100/32 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
            >
              <div className="ui-chrome flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45">
                    {pattern.category.replace('_', ' ')}
                  </p>
                  <h2 className="selectable-content mt-2 text-xl font-semibold leading-7 text-base-content">
                    {pattern.rule}
                  </h2>
                </div>
                <p className="shrink-0 text-right text-sm font-semibold text-primary">
                  {pattern.count}x<span className="block text-xs font-medium text-base-content/45">seen</span>
                </p>
              </div>
              <div className="selectable-content">
                <p className="mt-4 text-sm leading-6 text-base-content/62">{pattern.canonicalExample}</p>
                <p className="ui-chrome mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45">
                  Last seen {formatDateKeyLabel(pattern.lastSeenDateKey)}
                </p>
                {pattern.recentExamples.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {pattern.recentExamples.slice(0, 2).map((example) => (
                      <p key={example} className="text-sm leading-6 text-base-content/68">
                        {example}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </LearningPageState>
    </section>
  );
}

function LearningPageState({
  isLoading,
  isError,
  isEmpty,
  emptyTitle,
  emptyBody,
  onOpenPractice,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody: string;
  onOpenPractice: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  if (isLoading) {
    return <p className="ui-chrome text-sm text-base-content/60">Opening learning history...</p>;
  }

  if (isError) {
    return <p className="selectable-content text-sm text-error">Learning history is unavailable right now.</p>;
  }

  if (isEmpty) {
    return (
      <section className="ui-chrome max-w-2xl pt-2">
        <h2 className="text-2xl font-semibold">{emptyTitle}</h2>
        <p className="mt-4 text-sm leading-6 text-base-content/60">{emptyBody}</p>
        <button type="button" className="btn btn-primary mt-6 rounded-[0.7rem]" onClick={onOpenPractice}>
          Start practice
        </button>
      </section>
    );
  }

  return <>{children}</>;
}

function formatDateKeyLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) {
    return dateKey;
  }

  return new Date(year, month - 1, day).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function templateTitleFor(templateId: WritingTemplateId): string {
  return WRITING_TEMPLATES.find((template) => template.id === templateId)?.title ?? 'Writing Practice';
}

function FeedbackRewritePage({
  preview,
  reviewState,
  selfRepairAttempt,
  modelAnswerRevealed,
  rewritePracticeInput,
  saveState,
  onSelfRepairAttemptChange,
  onRevealModelAnswer,
  onSaveReview,
  onBackToDraft,
  onReviewCurrentVersion,
  onRewritePracticeInputChange,
}: {
  preview: ReviewPreviewSnapshot | null;
  reviewState: ReviewState;
  selfRepairAttempt: string;
  modelAnswerRevealed: boolean;
  rewritePracticeInput: string;
  saveState: SaveState;
  onSelfRepairAttemptChange: (value: string) => void;
  onRevealModelAnswer: () => void;
  onSaveReview: () => void;
  onBackToDraft: () => void;
  onReviewCurrentVersion: () => void;
  onRewritePracticeInputChange: (value: string) => void;
}): React.JSX.Element {
  if (!preview) {
    return (
      <section className="flex min-h-0 flex-1 flex-col gap-8" aria-labelledby="feedback-page-title">
        <div className="feedback-page__header ui-chrome flex min-h-[8rem] items-start justify-between gap-8 pb-3">
          <div>
            <p className="text-sm text-base-content/55">Practice / Feedback</p>
            <h1 id="feedback-page-title" className="editorial-heading mt-4 text-5xl text-base-content">
              Feedback & rewrite
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-base-content/60">
              Finish a draft, then ask for one focused review.
            </p>
          </div>
        </div>
        <div className="feedback-empty-state relative pt-4">
          <div className="feedback-empty-state__content ui-chrome max-w-xl">
            <h2 className="text-xl font-semibold">No review yet</h2>
            <p className="mt-3 text-sm leading-6 text-base-content/60">
              Feedback opens here after the coach reviews your draft.
            </p>
            <button type="button" className="btn btn-outline mt-6 rounded-[0.7rem]" onClick={onBackToDraft}>
              Back to draft
            </button>
          </div>
        </div>
      </section>
    );
  }

  const focusCorrection = getFocusCorrection(preview);
  const focusPatternTitle = focusCorrection
    ? (patternRule(focusCorrection) ?? focusCorrection.category)
    : 'One focus pattern';
  const referenceRewrite = preview.operations.referenceRewrites[0];
  const rewriteText = rewritePracticeInput || selfRepairAttempt;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-5"
      aria-labelledby="feedback-page-title"
      data-e2e="feedback-page"
    >
      <div className="feedback-page__header ui-chrome flex min-h-[8.5rem] items-start justify-between gap-8 pb-3">
        <div>
          <p className="text-sm text-base-content/55">Practice / Feedback</p>
          <h1 id="feedback-page-title" className="editorial-heading mt-4 text-5xl leading-none text-base-content">
            Feedback & rewrite
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-base-content/60">
            Work through one repair, then save the review to your learning history.
          </p>
        </div>
      </div>

      {preview.isStaleForCurrentWriting ? (
        <div className="ui-chrome flex flex-wrap items-center gap-3 rounded-lg bg-warning/10 px-4 py-3 text-sm leading-6 text-base-content/70">
          <span>This review belongs to an earlier draft.</span>
          <button type="button" className="btn btn-warning btn-sm rounded-[0.6rem]" onClick={onReviewCurrentVersion}>
            Review current draft
          </button>
        </div>
      ) : null}

      <div className="grid min-h-0 gap-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.25fr)]">
        <div className="grid content-start gap-9">
          <section className="selectable-content pb-1">
            <h2 className="editorial-copy flex items-center gap-3 text-xl text-base-content">
              <span className="inline-icon text-secondary" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
                </svg>
              </span>
              Overall feedback
            </h2>
            <p className="mt-3 text-sm leading-6 text-base-content/70">
              {preview.parsedOutput.summary.focusPattern.reason}
            </p>
          </section>

          <section className="selectable-content">
            <h2 className="editorial-copy text-xl text-base-content">One focus pattern</h2>
            <p className="mt-3 text-sm font-semibold text-primary">{focusPatternTitle}</p>
            {preview.parsedOutput.summary.whatWentWell[0] ? (
              <p className="mt-4 max-w-xl text-sm leading-6 text-base-content/65">
                {preview.parsedOutput.summary.whatWentWell[0]}
              </p>
            ) : null}
          </section>

          <section className="selectable-content">
            <h2 className="editorial-copy mb-3 text-xl text-base-content">Original draft</h2>
            <HighlightedWriting content={preview.reviewedContent} corrections={preview.operations.corrections} />
          </section>

          {referenceRewrite ? (
            <details className="selectable-content pt-6 text-sm text-base-content/62">
              <summary className="cursor-pointer font-medium text-base-content/70">Reference rewrite</summary>
              <p className="writing-practice-surface mt-3 whitespace-pre-wrap text-base leading-7 text-base-content/78">
                {referenceRewrite.text}
              </p>
              <p className="mt-3 leading-6">{referenceRewrite.noticeTheGap}</p>
            </details>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-rows-[minmax(31rem,1fr)_auto]">
          <section className="flex min-h-0 flex-col">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="editorial-copy flex items-center gap-3 text-2xl text-base-content">
                  <span className="inline-icon text-primary" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </span>
                  Try rewriting
                </h2>
                <p className="mt-2 text-sm text-base-content/60">Your rewrite</p>
              </div>
            </div>
            {focusCorrection ? (
              <p className="selectable-content mb-4 max-w-2xl text-sm leading-6 text-base-content/70">
                Hint: {preview.operations.selfRepair?.hint ?? focusCorrection.explanation}
              </p>
            ) : null}
            <textarea
              className="writing-practice-surface paper-sheet min-h-[23rem] flex-1 resize-none p-7 text-base-content outline-none placeholder:text-base-content/35"
              value={rewriteText}
              onChange={(event) => {
                onSelfRepairAttemptChange(event.target.value);
                onRewritePracticeInputChange(event.target.value);
              }}
              placeholder="Rewrite the focus sentence in your own words."
              aria-label="Your rewrite"
              data-e2e="self-repair-rewrite-input"
              spellCheck={false}
            />
            {focusCorrection && modelAnswerRevealed ? (
              <p className="selectable-content mt-4 text-sm leading-6 text-base-content/70">
                <strong>Reference answer:</strong> {focusCorrection.correctedText}
              </p>
            ) : null}
            {focusCorrection && !modelAnswerRevealed ? (
              <button
                type="button"
                className="btn btn-outline btn-sm mt-4 self-start rounded-[0.65rem]"
                onClick={onRevealModelAnswer}
              >
                Show reference answer
              </button>
            ) : null}
          </section>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-1">
        <button
          type="button"
          className="btn btn-outline rounded-[0.7rem] px-8"
          data-e2e="feedback-back-to-draft"
          onClick={onBackToDraft}
        >
          Back to draft
        </button>
        <button
          type="button"
          className="btn btn-primary rounded-[0.7rem] px-8 shadow-[0_12px_24px_rgba(22,71,101,0.18)]"
          disabled={reviewState === 'saving' || reviewState === 'saved'}
          data-e2e="save-review-button"
          onClick={onSaveReview}
        >
          {reviewState === 'saving'
            ? 'Saving review...'
            : reviewState === 'saved'
              ? 'Review saved'
              : 'Save review and update learning history'}
          <span aria-hidden="true">→</span>
        </button>
      </div>
      {saveState === 'error' ? (
        <p className="selectable-content text-right text-sm text-error">Could not save draft before feedback.</p>
      ) : null}
    </section>
  );
}

function AppInkDecoration({ activeArea }: { activeArea: AppArea }): React.JSX.Element {
  return (
    <div className={`app-ink app-ink--page app-ink--${activeArea}`} aria-hidden="true">
      <img src={feedbackInkLandscapeUrl} alt="" draggable={false} />
    </div>
  );
}
