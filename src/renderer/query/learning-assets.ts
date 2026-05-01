import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListErrorPatternsOutput, ListNotebookEntriesOutput } from '@shared/types/learning-assets';
import { queryKeys } from './keys';

export function useErrorPatterns(options: { enabled?: boolean } = {}): UseQueryResult<ListErrorPatternsOutput> {
  return useQuery({
    queryKey: queryKeys.learningAssets.errorPatterns,
    queryFn: () => window.api.learningAssets.listErrorPatterns(),
    enabled: options.enabled ?? true,
  });
}

export function useNotebookEntries(options: { enabled?: boolean } = {}): UseQueryResult<ListNotebookEntriesOutput> {
  return useQuery({
    queryKey: queryKeys.learningAssets.notebookEntries,
    queryFn: () => window.api.learningAssets.listNotebookEntries(),
    enabled: options.enabled ?? true,
  });
}
