import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/channels';
import type { StartupStatus } from '../shared/types/app';
import type {
  DeleteProviderApiKeyInput,
  ProviderCredentialMutationResult,
  ProviderKeyStatus,
  SetProviderApiKeyInput,
} from '../shared/types/credentials';
import type {
  AcknowledgeStarterPromptDisclosureInput,
  CompleteRewritePracticeInput,
  GenerateStarterPromptInput,
  GenerateStarterPromptResult,
  GetWritingAttemptInput,
  RewritePracticeUpdateResult,
  SaveWritingAttemptInput,
  SaveWritingAttemptResult,
  SkipRewritePracticeInput,
  WritingAttemptSnapshot,
} from '../shared/types/writing';
import type {
  AcknowledgeReviewDisclosureInput,
  GetReviewPreviewInput,
  ReviewPreviewSnapshot,
  ReviewProgressEvent,
  SaveReviewInput,
  SaveReviewOutput,
  StartReviewInput,
  StartReviewOutput,
} from '../shared/types/review';
import type { ListErrorPatternsOutput, ListNotebookEntriesOutput } from '../shared/types/learning-assets';
import type {
  SettingsSnapshot,
  SetDefaultProviderInput,
  SetOnboardingIntroVersionSeenInput,
  SetProviderConfigInput,
  SetRawResponseStorageInput,
} from '../shared/types/settings';

const api = {
  app: {
    getStartupStatus: (): Promise<StartupStatus> => ipcRenderer.invoke(IPC_CHANNELS.APP.GET_STARTUP_STATUS),
  },
  writing: {
    getCurrentAttempt: (): Promise<WritingAttemptSnapshot> =>
      ipcRenderer.invoke(IPC_CHANNELS.WRITING.GET_CURRENT_ATTEMPT),
    getWritingAttempt: (input: GetWritingAttemptInput): Promise<WritingAttemptSnapshot> =>
      ipcRenderer.invoke(IPC_CHANNELS.WRITING.GET_WRITING_ATTEMPT, input),
    generateStarterPrompt: (input: GenerateStarterPromptInput): Promise<GenerateStarterPromptResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.WRITING.GENERATE_STARTER_PROMPT, input),
    acknowledgeStarterPromptDisclosure: (input: AcknowledgeStarterPromptDisclosureInput): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.WRITING.ACKNOWLEDGE_STARTER_PROMPT_DISCLOSURE, input),
    saveWritingAttempt: (input: SaveWritingAttemptInput): Promise<SaveWritingAttemptResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.WRITING.SAVE_WRITING_ATTEMPT, input),
    completeRewritePractice: (input: CompleteRewritePracticeInput): Promise<RewritePracticeUpdateResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.WRITING.COMPLETE_REWRITE_PRACTICE, input),
    skipRewritePractice: (input: SkipRewritePracticeInput): Promise<RewritePracticeUpdateResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.WRITING.SKIP_REWRITE_PRACTICE, input),
  },
  settings: {
    get: (): Promise<SettingsSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET),
    setRawResponseStorage: (input: SetRawResponseStorageInput): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET_RAW_RESPONSE_STORAGE, input),
    setProviderConfig: (input: SetProviderConfigInput): Promise<SettingsSnapshot> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET_PROVIDER_CONFIG, input),
    setDefaultProvider: (input: SetDefaultProviderInput): Promise<SettingsSnapshot> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET_DEFAULT_PROVIDER, input),
    setOnboardingIntroVersionSeen: (input: SetOnboardingIntroVersionSeenInput): Promise<SettingsSnapshot> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET_ONBOARDING_INTRO_VERSION_SEEN, input),
  },
  credentials: {
    getProviderKeyStatus: (): Promise<ProviderKeyStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS.GET_PROVIDER_KEY_STATUS),
    setProviderApiKey: (input: SetProviderApiKeyInput): Promise<ProviderCredentialMutationResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS.SET_PROVIDER_API_KEY, input),
    deleteProviderApiKey: (input?: DeleteProviderApiKeyInput): Promise<ProviderCredentialMutationResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS.DELETE_PROVIDER_API_KEY, input),
  },
  review: {
    acknowledgeDisclosure: (input: AcknowledgeReviewDisclosureInput): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW.ACKNOWLEDGE_DISCLOSURE, input),
    start: (input: StartReviewInput): Promise<StartReviewOutput> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW.START, input),
    onProgress: (handler: (event: ReviewProgressEvent) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, progressEvent: ReviewProgressEvent): void => handler(progressEvent);
      ipcRenderer.on(IPC_CHANNELS.REVIEW.PROGRESS, wrapped);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.REVIEW.PROGRESS, wrapped);
    },
    getPreview: (input: GetReviewPreviewInput): Promise<ReviewPreviewSnapshot | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW.GET_PREVIEW, input),
    save: (input: SaveReviewInput): Promise<SaveReviewOutput> => ipcRenderer.invoke(IPC_CHANNELS.REVIEW.SAVE, input),
  },
  learningAssets: {
    listErrorPatterns: (): Promise<ListErrorPatternsOutput> =>
      ipcRenderer.invoke(IPC_CHANNELS.LEARNING_ASSETS.LIST_ERROR_PATTERNS),
    listNotebookEntries: (): Promise<ListNotebookEntriesOutput> =>
      ipcRenderer.invoke(IPC_CHANNELS.LEARNING_ASSETS.LIST_NOTEBOOK_ENTRIES),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
