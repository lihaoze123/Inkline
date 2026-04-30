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
  const writingQuery = useQuery({
    queryKey: queryKeys.writing.attempt('journal'),
    queryFn: () => window.api.writing.getCurrentAttempt(),
  });
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.snapshot,
    queryFn: () => window.api.settings.get(),
  });
  const startupQuery = useQuery({
    queryKey: queryKeys.app.startupStatus,
    queryFn: () => window.api.app.getStartupStatus(),
  });

  if (writingQuery.isPending || settingsQuery.isPending || startupQuery.isPending) {
    return { status: 'loading' };
  }

  if (writingQuery.isError || settingsQuery.isError || startupQuery.isError) {
    const error = writingQuery.error ?? settingsQuery.error ?? startupQuery.error;
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
