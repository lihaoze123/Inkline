import { useMutation, useQuery, useQueryClient, type QueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type {
  CompleteRewritePracticeInput,
  GenerateStarterPromptInput,
  GenerateStarterPromptResult,
  RewritePracticeUpdateResult,
  SaveWritingAttemptInput,
  SaveWritingAttemptResult,
  SkipRewritePracticeInput,
  WritingAttemptSnapshot,
  WritingTemplateId,
} from '@shared/types/writing';
import { queryKeys } from './keys';

type UseWritingAttemptOptions = {
  templateId: WritingTemplateId;
  initialData?: WritingAttemptSnapshot;
};

export function useWritingAttempt({ templateId, initialData }: UseWritingAttemptOptions): UseQueryResult<WritingAttemptSnapshot> {
  return useQuery({
    queryKey: queryKeys.writing.attempt(templateId),
    queryFn: () => window.api.writing.getWritingAttempt({ templateId }),
    initialData,
  });
}

export function updateWritingAttemptCache(queryClient: QueryClient, savedWriting: WritingAttemptSnapshot): void {
  queryClient.setQueryData(queryKeys.writing.attempt(savedWriting.templateId), savedWriting);
}

export function useSaveWritingAttempt(): UseMutationResult<SaveWritingAttemptResult, Error, SaveWritingAttemptInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveWritingAttemptInput) => window.api.writing.saveWritingAttempt(input),
    onSuccess: (savedWriting: SaveWritingAttemptResult) => {
      updateWritingAttemptCache(queryClient, savedWriting);
    },
  });
}

export function updateRewritePracticeCache(queryClient: QueryClient, result: RewritePracticeUpdateResult): void {
  if (result.success && result.writing) {
    updateWritingAttemptCache(queryClient, result.writing);
  }
}

export function useGenerateStarterPrompt(): UseMutationResult<GenerateStarterPromptResult, Error, GenerateStarterPromptInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateStarterPromptInput) => window.api.writing.generateStarterPrompt(input),
    onSuccess: (result) => {
      if (result.success && result.writing) {
        updateWritingAttemptCache(queryClient, result.writing);
      }
    },
  });
}

export function useCompleteRewritePractice(): UseMutationResult<RewritePracticeUpdateResult, Error, CompleteRewritePracticeInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CompleteRewritePracticeInput) => window.api.writing.completeRewritePractice(input),
    onSuccess: (result) => updateRewritePracticeCache(queryClient, result),
  });
}

export function useSkipRewritePractice(): UseMutationResult<RewritePracticeUpdateResult, Error, SkipRewritePracticeInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SkipRewritePracticeInput) => window.api.writing.skipRewritePractice(input),
    onSuccess: (result) => updateRewritePracticeCache(queryClient, result),
  });
}
