import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  ListErrorPatternsOutput,
  ListNotebookEntriesOutput,
  MergeErrorPatternsInput,
  MergeErrorPatternsResult,
} from '@shared/types/learning-assets';
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

export function invalidateErrorPatterns(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.learningAssets.errorPatterns });
}

export function useMergeErrorPatterns(): UseMutationResult<MergeErrorPatternsResult, Error, MergeErrorPatternsInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MergeErrorPatternsInput) => window.api.learningAssets.mergeErrorPatterns(input),
    onSuccess: (result) => {
      if (result.success === true) {
        void invalidateErrorPatterns(queryClient);
      }
    },
  });
}
