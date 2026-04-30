import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { providerCredentialMutationResultSchema, providerKeyStatusSchema, setProviderApiKeyInputSchema } from '../../shared/types/credentials';
import { setProviderConfigInputSchema, setRawResponseStorageInputSchema, settingsSnapshotSchema } from '../../shared/types/settings';
import {
  acknowledgeReviewDisclosureInputSchema,
  getReviewPreviewInputSchema,
  reviewPreviewSnapshotSchema,
  reviewProgressEventSchema,
  saveReviewInputSchema,
  saveReviewOutputSchema,
  startReviewInputSchema,
  startReviewOutputSchema,
} from '../../shared/types/review';
import { startupStatusSchema, type StartupStatus } from '../../shared/types/app';
import {
  acknowledgeStarterPromptDisclosureInputSchema,
  completeRewritePracticeInputSchema,
  generateStarterPromptInputSchema,
  generateStarterPromptResultSchema,
  getWritingAttemptInputSchema,
  rewritePracticeUpdateResultSchema,
  saveWritingAttemptInputSchema,
  saveWritingAttemptResultSchema,
  skipRewritePracticeInputSchema,
  writingAttemptSnapshotSchema,
} from '../../shared/types/writing';
import { getDatabasePath } from '../db/client';
import type { MigrationResult } from '../db/migrate';
import { deleteProviderApiKey, getProviderKeyStatus, setProviderApiKey } from '../services/credentials/service';
import {
  acknowledgeStarterPromptDisclosure,
  completeRewritePractice,
  generateStarterPrompt,
  getWritingAttempt,
  saveWritingAttempt,
  skipRewritePractice,
} from '../services/writing/service';
import { acknowledgeReviewDisclosure } from '../services/review/lib/disclosure';
import { getReviewPreview } from '../services/review/procedures/preview';
import { saveReviewRun } from '../services/review/procedures/save';
import { startReview } from '../services/review/procedures/start';
import { getSettingsSnapshot, setProviderConfig, setRawResponseStorage } from '../services/settings/service';

export function registerIpcHandlers(migrationResult: MigrationResult): void {
  ipcMain.handle(IPC_CHANNELS.APP.GET_STARTUP_STATUS, (): StartupStatus => {
    return startupStatusSchema.parse({
      databaseReady: migrationResult.success,
      databaseLocation: getDatabasePath(),
      migrationsApplied: migrationResult.success,
    });
  });

  ipcMain.handle(IPC_CHANNELS.WRITING.GET_CURRENT_ATTEMPT, (): unknown => {
    return writingAttemptSnapshotSchema.parse(getWritingAttempt());
  });

  ipcMain.handle(IPC_CHANNELS.WRITING.GET_WRITING_ATTEMPT, (_event, input: unknown): unknown => {
    const parsedInput = getWritingAttemptInputSchema.parse(input);
    return writingAttemptSnapshotSchema.parse(getWritingAttempt(parsedInput));
  });

  ipcMain.handle(IPC_CHANNELS.WRITING.GENERATE_STARTER_PROMPT, async (_event, input: unknown): Promise<unknown> => {
    const parsedInput = generateStarterPromptInputSchema.parse(input);
    return generateStarterPromptResultSchema.parse(await generateStarterPrompt(parsedInput));
  });

  ipcMain.handle(IPC_CHANNELS.WRITING.ACKNOWLEDGE_STARTER_PROMPT_DISCLOSURE, async (_event, input: unknown): Promise<boolean> => {
    acknowledgeStarterPromptDisclosureInputSchema.parse(input);
    return acknowledgeStarterPromptDisclosure();
  });

  ipcMain.handle(IPC_CHANNELS.WRITING.SAVE_WRITING_ATTEMPT, (_event, input: unknown): unknown => {
    const parsedInput = saveWritingAttemptInputSchema.parse(input);
    return saveWritingAttemptResultSchema.parse(saveWritingAttempt(parsedInput));
  });

  ipcMain.handle(IPC_CHANNELS.WRITING.COMPLETE_REWRITE_PRACTICE, (_event, input: unknown): unknown => {
    const parsedInput = completeRewritePracticeInputSchema.parse(input);
    return rewritePracticeUpdateResultSchema.parse(completeRewritePractice(parsedInput));
  });

  ipcMain.handle(IPC_CHANNELS.WRITING.SKIP_REWRITE_PRACTICE, (_event, input: unknown): unknown => {
    const parsedInput = skipRewritePracticeInputSchema.parse(input);
    return rewritePracticeUpdateResultSchema.parse(skipRewritePractice(parsedInput));
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET, async (): Promise<unknown> => {
    return settingsSnapshotSchema.parse(await getSettingsSnapshot());
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.SET_RAW_RESPONSE_STORAGE, (_event, input: unknown): boolean => {
    const parsedInput = setRawResponseStorageInputSchema.parse(input);
    return setRawResponseStorage(parsedInput);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.SET_PROVIDER_CONFIG, async (_event, input: unknown): Promise<unknown> => {
    const parsedInput = setProviderConfigInputSchema.parse(input);
    setProviderConfig(parsedInput);
    return settingsSnapshotSchema.parse(await getSettingsSnapshot());
  });

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.GET_PROVIDER_KEY_STATUS, async (): Promise<unknown> => {
    return providerKeyStatusSchema.parse(await getProviderKeyStatus());
  });

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.SET_PROVIDER_API_KEY, async (_event, input: unknown): Promise<unknown> => {
    const parsedInput = setProviderApiKeyInputSchema.parse(input);
    try {
      await setProviderApiKey(parsedInput.apiKey);
      return providerCredentialMutationResultSchema.parse({ success: true, status: await getProviderKeyStatus() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save provider API key.';
      return providerCredentialMutationResultSchema.parse({ success: false, error: message });
    }
  });

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.DELETE_PROVIDER_API_KEY, async (): Promise<unknown> => {
    try {
      await deleteProviderApiKey();
      return providerCredentialMutationResultSchema.parse({ success: true, status: await getProviderKeyStatus() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete provider API key.';
      return providerCredentialMutationResultSchema.parse({ success: false, error: message });
    }
  });

  ipcMain.handle(IPC_CHANNELS.REVIEW.ACKNOWLEDGE_DISCLOSURE, (_event, input: unknown): boolean => {
    acknowledgeReviewDisclosureInputSchema.parse(input);
    return acknowledgeReviewDisclosure();
  });

  ipcMain.handle(IPC_CHANNELS.REVIEW.START, async (event, input: unknown): Promise<unknown> => {
    const parsedInput = startReviewInputSchema.parse(input);
    return startReviewOutputSchema.parse(await startReview(parsedInput, {
      onProgress: (progressEvent) => {
        event.sender.send(IPC_CHANNELS.REVIEW.PROGRESS, reviewProgressEventSchema.parse(progressEvent));
      },
    }));
  });

  ipcMain.handle(IPC_CHANNELS.REVIEW.GET_PREVIEW, (_event, input: unknown): unknown => {
    const parsedInput = getReviewPreviewInputSchema.parse(input);
    const preview = getReviewPreview(parsedInput);
    return preview ? reviewPreviewSnapshotSchema.parse(preview) : null;
  });

  ipcMain.handle(IPC_CHANNELS.REVIEW.SAVE, (_event, input: unknown): unknown => {
    const parsedInput = saveReviewInputSchema.parse(input);
    return saveReviewOutputSchema.parse(saveReviewRun(parsedInput));
  });
}
