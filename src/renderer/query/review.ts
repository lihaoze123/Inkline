import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  ApplyReviewCorrectionInput,
  ApplyReviewCorrectionOutput,
  GetReviewPreviewInput,
  ReviewPreviewSnapshot,
  SaveReviewInput,
  SaveReviewOutput,
  StartReviewInput,
  StartReviewOutput,
} from '@shared/types/review';
import type { WritingTemplateId } from '@shared/types/writing';
import { queryKeys } from './keys';
import { updateWritingAttemptCache } from './writing';

type UseReviewPreviewOptions = {
  reviewRunId: string | null;
  enabled?: boolean;
};

export function useReviewPreview({
  reviewRunId,
  enabled = true,
}: UseReviewPreviewOptions): UseQueryResult<ReviewPreviewSnapshot | null> {
  return useQuery({
    queryKey: reviewRunId ? queryKeys.review.preview(reviewRunId) : queryKeys.review.preview(''),
    queryFn: () => {
      if (!reviewRunId) {
        return Promise.resolve(null);
      }

      return window.api.review.getPreview({ reviewRunId });
    },
    enabled: enabled && Boolean(reviewRunId),
  });
}

export function setReviewPreviewCache(
  queryClient: QueryClient,
  input: GetReviewPreviewInput,
  preview: ReviewPreviewSnapshot | null,
): void {
  queryClient.setQueryData(queryKeys.review.preview(input.reviewRunId), preview);
}

export function invalidateReviewPreview(queryClient: QueryClient, reviewRunId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.review.preview(reviewRunId) });
}

export function useStartReview(): UseMutationResult<
  StartReviewOutput,
  Error,
  StartReviewInput & { templateId: WritingTemplateId }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) =>
      window.api.review.start({
        writingAttemptId: input.writingAttemptId,
        writingRevisionId: input.writingRevisionId,
      }),
    onSuccess: (result, variables) => {
      if (result.reviewRun) {
        queryClient.setQueryData(queryKeys.review.run(result.reviewRun.id), result.reviewRun);
      }

      if (result.preview && result.reviewRun) {
        setReviewPreviewCache(queryClient, { reviewRunId: result.reviewRun.id }, result.preview);
      }

      if (result.success === true) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.writing.attempt(variables.templateId) });
      }
    },
  });
}

export function useSaveReview(): UseMutationResult<SaveReviewOutput, Error, SaveReviewInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveReviewInput) => window.api.review.save(input),
    onSuccess: (result, variables) => {
      if (result.reviewRun) {
        queryClient.setQueryData(queryKeys.review.run(result.reviewRun.id), result.reviewRun);
        void invalidateReviewPreview(queryClient, variables.reviewRunId);
      }

      if (result.writing) {
        updateWritingAttemptCache(queryClient, result.writing);
      }

      if (result.success === true) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.learningAssets.errorPatterns });
        void queryClient.invalidateQueries({ queryKey: queryKeys.learningAssets.notebookEntries });
      }
    },
  });
}

export function updateApplyCorrectionCache(queryClient: QueryClient, result: ApplyReviewCorrectionOutput): void {
  if (result.success !== true) {
    return;
  }

  queryClient.setQueryData(queryKeys.review.run(result.reviewRun.id), result.reviewRun);
  updateWritingAttemptCache(queryClient, result.writing);
  void invalidateReviewPreview(queryClient, result.reviewRun.id);
  void queryClient.invalidateQueries({ queryKey: queryKeys.learningAssets.learningEvents });
}

export function useApplyReviewCorrection(): UseMutationResult<
  ApplyReviewCorrectionOutput,
  Error,
  ApplyReviewCorrectionInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApplyReviewCorrectionInput) => window.api.review.applyCorrection(input),
    onSuccess: (result) => updateApplyCorrectionCache(queryClient, result),
  });
}
