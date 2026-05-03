import type { StartupStatus } from '@shared/types/app';
import type { WritingAttemptSnapshot, WritingTemplate, WritingTemplateId } from '@shared/types/writing';
import type {
  AnchoredCorrectionOperationSnapshot,
  ReviewPreviewSnapshot,
  ReviewProgressEvent,
  ReviewRunSnapshot,
} from '@shared/types/review';
import type { AiProviderId } from '@shared/types/credentials';
import type { SettingsSnapshot } from '@shared/types/settings';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type ReviewState = 'idle' | 'reviewing' | 'ready' | 'saving' | 'saved' | 'failed';

export type ReviewProgressModel = {
  activeRunId: string | null;
  events: ReviewProgressEvent[];
  currentEvent: ReviewProgressEvent | null;
  startedAt: number | null;
};

export type PracticeHeaderProps = {
  practicePromptTitle: string;
};

export type AutosaveStatusProps = {
  state: SaveState;
  lastAutosaveAt: number | null;
  error: string | null;
};

export type SettingsPageProps = {
  settings: SettingsSnapshot;
  startup: StartupStatus;
  openAiCompatibleBaseUrlInput: string;
  providerModelInputs: Record<AiProviderId, string>;
  apiKeyInputs: Record<AiProviderId, string>;
  message: string | null;
  error: string | null;
  onDefaultProviderChange: (providerId: AiProviderId) => void;
  onOpenAiCompatibleBaseUrlChange: (value: string) => void;
  onProviderModelChange: (providerId: AiProviderId, value: string) => void;
  onApiKeyChange: (providerId: AiProviderId, value: string) => void;
  onSaveProviderConfig: (providerId: AiProviderId) => void;
  onSaveApiKey: (providerId: AiProviderId) => void;
  onDeleteApiKey: (providerId: AiProviderId) => void;
  onRawResponseStorageChange: (enabled: boolean) => void;
  onReviewThinkingChange: (enabled: boolean) => void;
  onViewWelcomeIntro: () => void;
};

export type PracticeTemplatePickerProps = {
  templates: WritingTemplate[];
  selectedTemplateId: WritingTemplateId;
  onSelectTemplate: (templateId: WritingTemplateId) => void;
};

export type WritingEditorCardProps = {
  template: WritingTemplate;
  templates: WritingTemplate[];
  selectedTemplateId: WritingTemplateId;
  generatedPrompt: WritingAttemptSnapshot['generatedPrompt'];
  userGoal: string;
  isStarterPromptVisible: boolean;
  starterPromptState: 'idle' | 'generating' | 'error';
  starterPromptError: string | null;
  content: string;
  lastAutosaveAt: number | null;
  saveState: SaveState;
  saveError: string | null;
  onSelectTemplate: (templateId: WritingTemplateId) => void;
  onContentChange: (value: string) => void;
  onUserGoalChange: (value: string) => void;
  onGenerateStarterPrompt: () => void;
  onSkipStarterPrompt: () => void;
};

export type LearningPanelProps = {
  writing: WritingAttemptSnapshot;
  hasWritten: boolean;
  saveState: SaveState;
  reviewState: ReviewState;
  reviewError: string | null;
  reviewProgress: ReviewProgressModel;
  latestReviewRun: ReviewRunSnapshot | null;
  preview: ReviewPreviewSnapshot | null;
  onOpenFeedback: () => void;
  rewritePracticeInput: string;
  completedRewritePractice: WritingAttemptSnapshot['pendingRewritePractice'];
  rewritePracticeError: string | null;
  isRewritePracticeChecking: boolean;
  onRewritePracticeInputChange: (value: string) => void;
  onCompleteRewritePractice: () => void;
  onRetryRewriteCheck: () => void;
  onSkipRewritePractice: () => void;
  onReviewCurrentVersion: () => void;
};

export type RevealAnswerDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  onReveal: () => void;
};

export type ReviewDisclosureDialogProps = {
  settings: SettingsSnapshot;
  mode?: 'review' | 'starter';
  onCancel: () => void;
  onAcknowledge: () => void;
};

export type CorrectionCardProps = {
  correction: AnchoredCorrectionOperationSnapshot;
  showAnswer: boolean;
  reason?: string;
};
