import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  ExportLearningHistoryInput,
  LearningHistoryExportResult,
  ListErrorPatternsOutput,
  ListNotebookEntriesOutput,
  MergeErrorPatternsInput,
  MergeErrorPatternsResult,
  PreviewLearningHistoryImportResult,
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

export function useExportLearningHistory(): UseMutationResult<
  LearningHistoryExportResult,
  Error,
  ExportLearningHistoryInput | undefined
> {
  return useMutation({
    mutationFn: (input) => window.api.learningAssets.exportLearningHistory(input),
  });
}

export function useCreateLearningHistoryBackup(): UseMutationResult<
  LearningHistoryExportResult,
  Error,
  ExportLearningHistoryInput | undefined
> {
  return useMutation({
    mutationFn: (input) => window.api.learningAssets.createLearningHistoryBackup(input),
  });
}

export function usePreviewLearningHistoryImport(): UseMutationResult<PreviewLearningHistoryImportResult, Error, void> {
  return useMutation({
    mutationFn: () => window.api.learningAssets.previewLearningHistoryImport(),
  });
}
