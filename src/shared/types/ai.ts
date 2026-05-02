import { z } from 'zod';

export const aiProviderFailureKindSchema = z.enum([
  'missing_config',
  'timeout',
  'invalid_json',
  'length',
  'no_output',
  'provider_error',
  'validation_failed',
]);

export const aiReasoningEffortSchema = z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);

export const aiProviderTokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative().nullable(),
  reasoningTokens: z.number().int().nonnegative().nullable(),
  textTokens: z.number().int().nonnegative().nullable(),
  cachedInputTokens: z.number().int().nonnegative().nullable(),
});

export const aiProviderDiagnosticsSchema = z.object({
  finishReason: z.string().min(1).max(120).nullable(),
  rawFinishReason: z.string().min(1).max(120).nullable(),
  usage: aiProviderTokenUsageSchema.nullable(),
  warningCount: z.number().int().nonnegative(),
  warnings: z.array(z.string().min(1).max(240)).max(5),
  responseId: z.string().min(1).max(160).nullable(),
  responseModelId: z.string().min(1).max(160).nullable(),
  providerMetadataKeys: z.array(z.string().min(1).max(80)).max(10),
  reasoningEnabled: z.boolean().nullable().default(null),
  reasoningEffort: aiReasoningEffortSchema.nullable().default(null),
  reasoningRequestedEffort: aiReasoningEffortSchema.nullable().default(null),
  reasoningEffectiveEffort: aiReasoningEffortSchema.nullable().default(null),
  reasoningFallbackUsed: z.boolean().default(false),
  reasoningFallbackReason: z.string().min(1).max(240).nullable().default(null),
  errorName: z.string().min(1).max(120).nullable(),
  errorMessage: z.string().min(1).max(240).nullable(),
  failureKind: aiProviderFailureKindSchema.nullable(),
});

export type AiReasoningEffort = z.infer<typeof aiReasoningEffortSchema>;
export type AiProviderFailureKind = z.infer<typeof aiProviderFailureKindSchema>;
export type AiProviderTokenUsage = z.infer<typeof aiProviderTokenUsageSchema>;
export type AiProviderDiagnostics = z.infer<typeof aiProviderDiagnosticsSchema>;

export function sanitizeAiProviderDiagnosticText(message: string): string {
  return redactSecrets(message).replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function safeAiProviderDiagnosticErrorMessage(params: {
  failureKind: AiProviderFailureKind | null;
  message: string;
}): string {
  switch (params.failureKind) {
    case 'missing_config':
      return sanitizeAiProviderDiagnosticText(params.message);
    case 'timeout':
      return 'Provider request timed out.';
    case 'invalid_json':
      return 'Provider returned invalid JSON.';
    case 'length':
      return 'Provider stopped after reaching the output token limit.';
    case 'no_output':
      return 'Provider returned no usable output.';
    case 'validation_failed':
      return 'Provider output failed app validation.';
    case 'provider_error':
      return 'Provider request failed.';
    case null:
      return 'Provider diagnostic message unavailable.';
  }
}

function redactSecrets(message: string): string {
  return message
    .replace(/\b((?:sk|sk-ant|sk-proj|rk|pk)-)[A-Za-z0-9_-]{8,}\b/gi, '$1[REDACTED]')
    .replace(/\b(authorization\s*[:=]\s*bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/\b(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/\b(api[_-]?key|access_token|token|key)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/\b(api[_-]?key\s*[:=]\s*)["']?[^"',\s}]+/gi, '$1[REDACTED]');
}
