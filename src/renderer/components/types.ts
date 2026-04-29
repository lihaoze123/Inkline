import type { StartupStatus } from '@shared/types/app';
import type { TodayJournalSnapshot } from '@shared/types/journal';
import type { AnchoredCorrectionOperationSnapshot, ReviewPreviewSnapshot, ReviewProgressEvent, ReviewRunSnapshot } from '@shared/types/review';
import type { SettingsSnapshot } from '@shared/types/settings';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type ReviewState = 'idle' | 'reviewing' | 'ready' | 'saving' | 'saved' | 'failed';

export type ReviewProgressModel = {
  activeRunId: string | null;
  events: ReviewProgressEvent[];
  currentEvent: ReviewProgressEvent | null;
  startedAt: number | null;
};

export type AppReadiness = 'ready' | 'setup-needed' | 'error';

export type AppStatusModel = {
  readiness: AppReadiness;
  label: string;
  toneClassName: string;
  detail: string;
};

export type TodayHeaderProps = {
  startup: StartupStatus;
  status: AppStatusModel;
  onOpenSettings: () => void;
};

export type AutosaveStatusProps = {
  state: SaveState;
  lastAutosaveAt: number | null;
  error: string | null;
};

export type SettingsDrawerProps = {
  isOpen: boolean;
  settings: SettingsSnapshot;
  startup: StartupStatus;
  baseUrlInput: string;
  modelInput: string;
  apiKeyInput: string;
  message: string | null;
  error: string | null;
  onClose: () => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onSaveProviderConfig: () => void;
  onSaveApiKey: () => void;
  onDeleteApiKey: () => void;
  onRawResponseStorageChange: (enabled: boolean) => void;
};

export type JournalEditorCardProps = {
  content: string;
  lastAutosaveAt: number | null;
  saveState: SaveState;
  saveError: string | null;
  highlightedContent: string | null;
  highlightedCorrections: AnchoredCorrectionOperationSnapshot[];
  onContentChange: (value: string) => void;
};

export type LearningPanelProps = {
  journal: TodayJournalSnapshot;
  hasWritten: boolean;
  saveState: SaveState;
  reviewState: ReviewState;
  reviewError: string | null;
  reviewProgress: ReviewProgressModel;
  latestReviewRun: ReviewRunSnapshot | null;
  preview: ReviewPreviewSnapshot | null;
  selfRepairAttempt: string;
  modelAnswerRevealed: boolean;
  onSelfRepairAttemptChange: (value: string) => void;
  onRevealModelAnswer: () => void;
  onSaveReview: () => void;
  rewritePracticeInput: string;
  completedRewritePractice: TodayJournalSnapshot['pendingRewritePractice'];
  rewritePracticeError: string | null;
  onRewritePracticeInputChange: (value: string) => void;
  onCompleteRewritePractice: () => void;
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
  onCancel: () => void;
  onAcknowledge: () => void;
};

export type CorrectionCardProps = {
  correction: AnchoredCorrectionOperationSnapshot;
  showAnswer: boolean;
  reason?: string;
};
