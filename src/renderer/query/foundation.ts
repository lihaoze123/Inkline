import { useQuery } from '@tanstack/react-query';
import type { StartupStatus } from '@shared/types/app';
import type { SettingsSnapshot } from '@shared/types/settings';
import type { WritingAttemptSnapshot } from '@shared/types/writing';
import { queryKeys } from './keys';

type FoundationData = {
  writing: WritingAttemptSnapshot;
  settings: SettingsSnapshot;
  startup: StartupStatus;
};

type FoundationState =
  | { status: 'loading' }
  | { status: 'ready'; data: FoundationData }
  | { status: 'error'; message: string };

export function useFoundationState(): FoundationState {
  const startupQuery = useQuery({
    queryKey: queryKeys.app.startupStatus,
    queryFn: () => window.api.app.getStartupStatus(),
  });
  const canLoadDatabaseBackedData =
    startupQuery.data?.databaseReady === true && startupQuery.data.migrationsApplied === true;
  const writingQuery = useQuery({
    queryKey: queryKeys.writing.attempt('journal'),
    queryFn: () => window.api.writing.getCurrentAttempt(),
    enabled: canLoadDatabaseBackedData,
  });
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.snapshot,
    queryFn: () => window.api.settings.get(),
    enabled: canLoadDatabaseBackedData,
  });

  if (startupQuery.isPending) {
    return { status: 'loading' };
  }

  if (startupQuery.isError) {
    const error = startupQuery.error;
    return { status: 'error', message: error instanceof Error ? error.message : 'Unable to load application state.' };
  }

  if (!startupQuery.data.databaseReady) {
    return { status: 'error', message: `Database unavailable: ${startupQuery.data.databaseLocation}` };
  }

  if (!startupQuery.data.migrationsApplied) {
    return { status: 'error', message: `Database migrations unavailable: ${startupQuery.data.databaseLocation}` };
  }

  if (writingQuery.isPending || settingsQuery.isPending) {
    return { status: 'loading' };
  }

  if (writingQuery.isError || settingsQuery.isError) {
    const error = writingQuery.error ?? settingsQuery.error;
    return { status: 'error', message: error instanceof Error ? error.message : 'Unable to load application state.' };
  }

  return {
    status: 'ready',
    data: {
      writing: writingQuery.data,
      settings: settingsQuery.data,
      startup: startupQuery.data,
    },
  };
}
