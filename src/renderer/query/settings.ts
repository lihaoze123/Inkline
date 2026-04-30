import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { AiProviderId, ProviderCredentialMutationResult } from '@shared/types/credentials';
import type {
  SettingsSnapshot,
  SetDefaultProviderInput,
  SetProviderConfigInput,
  SetRawResponseStorageInput,
} from '@shared/types/settings';
import { queryKeys } from './keys';

export function useSettingsSnapshot(initialData?: SettingsSnapshot): UseQueryResult<SettingsSnapshot> {
  return useQuery({
    queryKey: queryKeys.settings.snapshot,
    queryFn: () => window.api.settings.get(),
    initialData,
  });
}

export function updateSettingsCache(queryClient: QueryClient, settings: SettingsSnapshot): void {
  queryClient.setQueryData(queryKeys.settings.snapshot, settings);
}

export function invalidateSettingsCache(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.settings.snapshot });
}

export function useSetDefaultProvider(): UseMutationResult<SettingsSnapshot, Error, SetDefaultProviderInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetDefaultProviderInput) => window.api.settings.setDefaultProvider(input),
    onSuccess: (settings) => updateSettingsCache(queryClient, settings),
  });
}

export function useSetProviderConfig(): UseMutationResult<SettingsSnapshot, Error, SetProviderConfigInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetProviderConfigInput) => window.api.settings.setProviderConfig(input),
    onSuccess: (settings) => updateSettingsCache(queryClient, settings),
  });
}

export function useSetProviderApiKey(): UseMutationResult<
  ProviderCredentialMutationResult,
  Error,
  { providerId: AiProviderId; apiKey: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => window.api.credentials.setProviderApiKey(input),
    onSuccess: async (result) => {
      if (result.success) {
        await invalidateSettingsCache(queryClient);
      }
    },
  });
}

export function useDeleteProviderApiKey(): UseMutationResult<
  ProviderCredentialMutationResult,
  Error,
  { providerId: AiProviderId }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => window.api.credentials.deleteProviderApiKey(input),
    onSuccess: async (result) => {
      if (result.success) {
        await invalidateSettingsCache(queryClient);
      }
    },
  });
}

export function useSetRawResponseStorage(): UseMutationResult<boolean, Error, SetRawResponseStorageInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetRawResponseStorageInput) => window.api.settings.setRawResponseStorage(input),
    onSuccess: async () => {
      await invalidateSettingsCache(queryClient);
    },
  });
}
