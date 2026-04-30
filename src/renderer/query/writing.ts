import { useMutation, useQuery, useQueryClient, type QueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { SaveWritingAttemptInput, SaveWritingAttemptResult, WritingAttemptSnapshot, WritingTemplateId } from '@shared/types/writing';
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
