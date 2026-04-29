import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/channels';
import type { StartupStatus } from '../shared/types/app';
import type { ProviderKeyStatus } from '../shared/types/credentials';
import type {
  CompleteRewritePracticeInput,
  RewritePracticeUpdateResult,
  SaveTodayJournalInput,
  SaveTodayJournalResult,
  SkipRewritePracticeInput,
  TodayJournalSnapshot,
} from '../shared/types/journal';
import type {
  AcknowledgeReviewDisclosureInput,
  GetReviewPreviewInput,
  ReviewPreviewSnapshot,
  SaveReviewInput,
  SaveReviewOutput,
  StartReviewInput,
  StartReviewOutput,
} from '../shared/types/review';
import type { SettingsSnapshot, SetRawResponseStorageInput } from '../shared/types/settings';

const api = {
  app: {
    getStartupStatus: (): Promise<StartupStatus> => ipcRenderer.invoke(IPC_CHANNELS.APP.GET_STARTUP_STATUS),
  },
  journal: {
    getToday: (): Promise<TodayJournalSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.JOURNAL.GET_TODAY),
    saveToday: (input: SaveTodayJournalInput): Promise<SaveTodayJournalResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.JOURNAL.SAVE_TODAY, input),
    completeRewritePractice: (input: CompleteRewritePracticeInput): Promise<RewritePracticeUpdateResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.JOURNAL.COMPLETE_REWRITE_PRACTICE, input),
    skipRewritePractice: (input: SkipRewritePracticeInput): Promise<RewritePracticeUpdateResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.JOURNAL.SKIP_REWRITE_PRACTICE, input),
  },
  settings: {
    get: (): Promise<SettingsSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET),
    setRawResponseStorage: (input: SetRawResponseStorageInput): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET_RAW_RESPONSE_STORAGE, input),
  },
  credentials: {
    getProviderKeyStatus: (): Promise<ProviderKeyStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS.GET_PROVIDER_KEY_STATUS),
  },
  review: {
    acknowledgeDisclosure: (input: AcknowledgeReviewDisclosureInput): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW.ACKNOWLEDGE_DISCLOSURE, input),
    start: (input: StartReviewInput): Promise<StartReviewOutput> => ipcRenderer.invoke(IPC_CHANNELS.REVIEW.START, input),
    getPreview: (input: GetReviewPreviewInput): Promise<ReviewPreviewSnapshot | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW.GET_PREVIEW, input),
    save: (input: SaveReviewInput): Promise<SaveReviewOutput> => ipcRenderer.invoke(IPC_CHANNELS.REVIEW.SAVE, input),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
