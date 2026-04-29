import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { providerKeyStatusSchema } from '../../shared/types/credentials';
import { setRawResponseStorageInputSchema, settingsSnapshotSchema } from '../../shared/types/settings';
import { startupStatusSchema, type StartupStatus } from '../../shared/types/app';
import {
  saveTodayJournalInputSchema,
  saveTodayJournalResultSchema,
  todayJournalSnapshotSchema,
} from '../../shared/types/journal';
import { getDatabasePath } from '../db/client';
import type { MigrationResult } from '../db/migrate';
import { getProviderKeyStatus } from '../services/credentials/service';
import { getTodayJournal, saveTodayJournal } from '../services/journal/service';
import { getSettingsSnapshot, setRawResponseStorage } from '../services/settings/service';

export function registerIpcHandlers(migrationResult: MigrationResult): void {
  ipcMain.handle(IPC_CHANNELS.APP.GET_STARTUP_STATUS, (): StartupStatus => {
    return startupStatusSchema.parse({
      databaseReady: migrationResult.success,
      databaseLocation: getDatabasePath(),
      migrationsApplied: migrationResult.success,
    });
  });

  ipcMain.handle(IPC_CHANNELS.JOURNAL.GET_TODAY, (): unknown => {
    return todayJournalSnapshotSchema.parse(getTodayJournal());
  });

  ipcMain.handle(IPC_CHANNELS.JOURNAL.SAVE_TODAY, (_event, input: unknown): unknown => {
    const parsedInput = saveTodayJournalInputSchema.parse(input);
    return saveTodayJournalResultSchema.parse(saveTodayJournal(parsedInput));
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET, async (): Promise<unknown> => {
    return settingsSnapshotSchema.parse(await getSettingsSnapshot());
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.SET_RAW_RESPONSE_STORAGE, (_event, input: unknown): boolean => {
    const parsedInput = setRawResponseStorageInputSchema.parse(input);
    return setRawResponseStorage(parsedInput);
  });

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.GET_PROVIDER_KEY_STATUS, async (): Promise<unknown> => {
    return providerKeyStatusSchema.parse(await getProviderKeyStatus());
  });
}
