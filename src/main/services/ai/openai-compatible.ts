const CHAT_COMPLETIONS_ENDPOINT_SUFFIX = '/chat/completions';

export function normalizeOpenAiCompatibleBaseUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, '');

  if (!trimmedBaseUrl.toLowerCase().endsWith(CHAT_COMPLETIONS_ENDPOINT_SUFFIX)) {
    return trimmedBaseUrl;
  }

  const normalizedBaseUrl = trimmedBaseUrl.slice(0, -CHAT_COMPLETIONS_ENDPOINT_SUFFIX.length).replace(/\/+$/, '');

  return normalizedBaseUrl.length > 0 ? normalizedBaseUrl : trimmedBaseUrl;
}
