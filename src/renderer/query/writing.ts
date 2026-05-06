import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  CompleteRewritePracticeInput,
  GenerateStarterPromptInput,
  GenerateStarterPromptResult,
  RetryRewriteCheckInput,
  RetryRewriteCheckResult,
  RewriteCheckSnapshot,
  RewritePracticeSnapshot,
  RewritePracticeUpdateResult,
  SaveWritingAttemptInput,
  SaveWritingAttemptResult,
  SkipRewritePracticeInput,
  SnoozeRewritePracticeInput,
  WritingAttemptSnapshot,
  WritingTemplateId,
} from '@shared/types/writing';
import { queryKeys } from './keys';

type UseWritingAttemptOptions = {
  templateId: WritingTemplateId;
  initialData?: WritingAttemptSnapshot;
};

export function useWritingAttempt({
  templateId,
  initialData,
}: UseWritingAttemptOptions): UseQueryResult<WritingAttemptSnapshot> {
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

export function updateRewritePracticeCache(
  queryClient: QueryClient,
  result: RewritePracticeUpdateResult | RetryRewriteCheckResult,
): void {
  if (!result.success) {
    return;
  }

  if (result.writing) {
    updateWritingAttemptCache(queryClient, result.writing);
    queryClient.setQueriesData<WritingAttemptSnapshot>({ queryKey: queryKeys.writing.attempts }, (cachedWriting) => {
      if (!cachedWriting) {
        return cachedWriting;
      }

      return {
        ...cachedWriting,
        pendingRewritePractice: result.writing?.pendingRewritePractice ?? null,
      };
    });
    return;
  }

  const rewritePractice = result.rewritePractice;
  const rewriteCheck = 'rewriteCheck' in result ? result.rewriteCheck : undefined;

  if (rewritePractice !== undefined) {
    updateCachedRewritePractice(queryClient, rewritePractice);
  }

  if (rewriteCheck) {
    updateCachedRewriteCheck(queryClient, rewriteCheck);
  }
}

function updateCachedRewritePractice(queryClient: QueryClient, rewritePractice: RewritePracticeSnapshot | null): void {
  if (!rewritePractice) {
    return;
  }

  queryClient.setQueriesData<WritingAttemptSnapshot>({ queryKey: queryKeys.writing.attempts }, (cachedWriting) => {
    if (!cachedWriting || cachedWriting.pendingRewritePractice?.id !== rewritePractice.id) {
      return cachedWriting;
    }

    return {
      ...cachedWriting,
      pendingRewritePractice: rewritePractice,
    };
  });
}

function updateCachedRewriteCheck(queryClient: QueryClient, rewriteCheck: RewriteCheckSnapshot): void {
  queryClient.setQueriesData<WritingAttemptSnapshot>({ queryKey: queryKeys.writing.attempts }, (cachedWriting) => {
    const cachedRewritePractice = cachedWriting?.pendingRewritePractice;
    if (!cachedWriting || !cachedRewritePractice || cachedRewritePractice.id !== rewriteCheck.rewriteTaskId) {
      return cachedWriting;
    }

    return {
      ...cachedWriting,
      pendingRewritePractice: {
        ...cachedRewritePractice,
        latestRewriteCheck: rewriteCheck,
      },
    };
  });
}

export function useGenerateStarterPrompt(): UseMutationResult<
  GenerateStarterPromptResult,
  Error,
  GenerateStarterPromptInput
> {
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

export function useCompleteRewritePractice(): UseMutationResult<
  RewritePracticeUpdateResult,
  Error,
  CompleteRewritePracticeInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CompleteRewritePracticeInput) => window.api.writing.completeRewritePractice(input),
    onSuccess: (result) => updateRewritePracticeCache(queryClient, result),
  });
}

export function useSkipRewritePractice(): UseMutationResult<
  RewritePracticeUpdateResult,
  Error,
  SkipRewritePracticeInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SkipRewritePracticeInput) => window.api.writing.skipRewritePractice(input),
    onSuccess: (result) => updateRewritePracticeCache(queryClient, result),
  });
}

export function useSnoozeRewritePractice(): UseMutationResult<
  RewritePracticeUpdateResult,
  Error,
  SnoozeRewritePracticeInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SnoozeRewritePracticeInput) => window.api.writing.snoozeRewritePractice(input),
    onSuccess: (result) => updateRewritePracticeCache(queryClient, result),
  });
}

export function useRetryRewriteCheck(): UseMutationResult<RetryRewriteCheckResult, Error, RetryRewriteCheckInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RetryRewriteCheckInput) => window.api.writing.retryRewriteCheck(input),
    onSuccess: (result) => updateRewritePracticeCache(queryClient, result),
  });
}
