import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/channels';
import type { StartupStatus } from '../shared/types/app';
import type { ProviderKeyStatus } from '../shared/types/credentials';
import type { SaveTodayJournalInput, SaveTodayJournalResult, TodayJournalSnapshot } from '../shared/types/journal';
import type { SettingsSnapshot, SetRawResponseStorageInput } from '../shared/types/settings';

const api = {
  app: {
    getStartupStatus: (): Promise<StartupStatus> => ipcRenderer.invoke(IPC_CHANNELS.APP.GET_STARTUP_STATUS),
  },
  journal: {
    getToday: (): Promise<TodayJournalSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.JOURNAL.GET_TODAY),
    saveToday: (input: SaveTodayJournalInput): Promise<SaveTodayJournalResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.JOURNAL.SAVE_TODAY, input),
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
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
