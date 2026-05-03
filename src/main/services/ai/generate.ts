import { asSchema, generateText, Output } from 'ai';
import type { FlexibleSchema } from 'ai';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import {
  aiProviderDiagnosticsSchema,
  aiReasoningEffortSchema,
  safeAiProviderDiagnosticErrorMessage,
  sanitizeAiProviderDiagnosticText,
  type AiReasoningEffort,
  type AiProviderDiagnostics,
  type AiProviderFailureKind,
  type AiProviderTokenUsage,
} from '../../../shared/types/ai';
import { aiGenerationRequestSchema, aiGenerationResultSchema, aiProviderRuntimeConfigSchema } from './types';
import type { AiGenerationRequest, AiGenerationResult, AiProviderRuntimeConfig } from './types';
import { createAiProviderModel } from './provider';
import { getE2eMockStructuredOutput } from './e2e-mock';

type AiGenerationMetadataSource = {
  finishReason?: unknown;
  rawFinishReason?: unknown;
  usage?: unknown;
  warnings?: unknown;
  response?: unknown;
  providerMetadata?: unknown;
};

type AiGenerationErrorWithDiagnostics = Error & {
  providerDiagnostics?: AiProviderDiagnostics;
};

type AiGenerationReasoningFallback = {
  used: boolean;
  reason: string | null;
};

export async function generateStructuredObject<OutputObject>(
  input: AiGenerationRequest & {
    runtimeConfig: AiProviderRuntimeConfig;
    schema: FlexibleSchema<OutputObject>;
    schemaName: string;
    schemaDescription?: string;
  },
): Promise<AiGenerationResult & { output: OutputObject }> {
  const parsedRequest = aiGenerationRequestSchema.parse(input);
  const runtimeConfig = aiProviderRuntimeConfigSchema.parse(input.runtimeConfig);
  const e2eMockOutput = await getE2eMockStructuredOutput(input.schemaName);

  if (e2eMockOutput.enabled) {
    const output = await validateStructuredOutput(e2eMockOutput.output, input.schema);
    const generationResult = aiGenerationResultSchema.parse({
      output,
      rawOutput: e2eMockOutput.rawOutput,
      providerDiagnostics: null,
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
    });

    return {
      ...generationResult,
      output,
    };
  }

  const providerModel = createAiProviderModel(runtimeConfig);
  const useJsonObjectMode = providerModel.provider === 'openai-compatible';
  let providerDiagnostics: AiProviderDiagnostics | null = null;
  let reasoningFallback: AiGenerationReasoningFallback = { used: false, reason: null };
  const system = await buildSystemPromptWithJsonInstruction({
    systemPrompt: parsedRequest.systemPrompt,
    schema: input.schema,
    schemaName: input.schemaName,
    schemaDescription: input.schemaDescription,
    useJsonObjectMode,
  });
  const output = useJsonObjectMode
    ? Output.json({ name: input.schemaName, description: input.schemaDescription })
    : Output.object({
        schema: input.schema,
        name: input.schemaName,
        description: input.schemaDescription,
      });
  const generateWithProviderOptions = (providerOptions: ProviderOptions | undefined): ReturnType<typeof generateText> =>
    generateText({
      model: providerModel.languageModel,
      system,
      prompt: parsedRequest.userPrompt,
      output,
      temperature: parsedRequest.temperature,
      maxOutputTokens: parsedRequest.maxOutputTokens,
      maxRetries: parsedRequest.maxRetries ?? 0,
      timeout: parsedRequest.timeoutMs,
      providerOptions,
      onStepFinish: (event) => {
        providerDiagnostics = addReasoningDiagnostics(
          buildAiProviderDiagnostics(event),
          parsedRequest.providerOptions,
          reasoningFallback,
        );
      },
    });

  try {
    let result: Awaited<ReturnType<typeof generateWithProviderOptions>>;
    try {
      result = await generateWithProviderOptions(parsedRequest.providerOptions);
    } catch (error) {
      if (!shouldRetryWithoutReasoningEffortNone(error, parsedRequest.providerOptions)) {
        throw error;
      }

      reasoningFallback = {
        used: true,
        reason: 'Provider rejected reasoningEffort none; retried without reasoningEffort.',
      };
      result = await generateWithProviderOptions(removeOpenAiReasoningEffort(parsedRequest.providerOptions));
    }

    providerDiagnostics = addReasoningDiagnostics(
      buildAiProviderDiagnostics(result),
      parsedRequest.providerOptions,
      reasoningFallback,
    );
    const output: OutputObject = useJsonObjectMode
      ? await validateStructuredOutput(result.output, input.schema)
      : (result.output as OutputObject);
    const generationResult = aiGenerationResultSchema.parse({
      output,
      rawOutput: {
        finishReason: result.finishReason,
        rawFinishReason: result.rawFinishReason,
        usage: result.usage,
        warnings: result.warnings,
        request: result.request,
        response: result.response,
        providerMetadata: result.providerMetadata,
        providerDiagnostics,
      },
      providerDiagnostics,
      provider: providerModel.provider,
      model: providerModel.model,
    });

    return {
      ...generationResult,
      output,
    };
  } catch (error) {
    throwAiGenerationErrorWithDiagnostics(error, providerDiagnostics, parsedRequest.providerOptions, reasoningFallback);
  }
}

export function getAiProviderDiagnosticsFromError(error: unknown): AiProviderDiagnostics | null {
  if (typeof error !== 'object' || error === null || !('providerDiagnostics' in error)) {
    return null;
  }

  const parseResult = aiProviderDiagnosticsSchema.safeParse(
    (error as { providerDiagnostics?: unknown }).providerDiagnostics,
  );
  return parseResult.success ? parseResult.data : null;
}

async function validateStructuredOutput<OutputObject>(
  output: unknown,
  schema: FlexibleSchema<OutputObject>,
): Promise<OutputObject> {
  const validation = await asSchema(schema).validate?.(output);

  if (validation && !validation.success) {
    throw validation.error;
  }

  return validation?.value ?? (output as OutputObject);
}

async function buildSystemPromptWithJsonInstruction<OutputObject>({
  systemPrompt,
  schema,
  schemaName,
  schemaDescription,
  useJsonObjectMode,
}: {
  systemPrompt: string;
  schema: FlexibleSchema<OutputObject>;
  schemaName: string;
  schemaDescription?: string;
  useJsonObjectMode: boolean;
}): Promise<string> {
  if (!useJsonObjectMode) {
    return systemPrompt;
  }

  const jsonSchema = await asSchema(schema).jsonSchema;
  const schemaLabel = schemaDescription ? `${schemaName}: ${schemaDescription}` : schemaName;

  return `${systemPrompt}\n\nReturn only a JSON object that matches this schema for ${schemaLabel}. Do not wrap it in markdown.\nJSON schema:\n${JSON.stringify(jsonSchema)}`;
}

function throwAiGenerationErrorWithDiagnostics(
  error: unknown,
  providerDiagnostics: AiProviderDiagnostics | null,
  providerOptions: ProviderOptions | undefined,
  reasoningFallback: AiGenerationReasoningFallback,
): never {
  const normalizedError = error instanceof Error ? error : new Error('AI provider generation failed.');
  const diagnostics = addReasoningDiagnostics(
    buildAiProviderDiagnostics(providerDiagnostics ?? {}, normalizedError),
    providerOptions,
    reasoningFallback,
  );
  (normalizedError as AiGenerationErrorWithDiagnostics).providerDiagnostics = diagnostics;
  throw normalizedError;
}

function buildAiProviderDiagnostics(
  source: AiGenerationMetadataSource | AiProviderDiagnostics,
  error?: Error,
): AiProviderDiagnostics {
  const existingDiagnostics = aiProviderDiagnosticsSchema.safeParse(source);
  const existing = existingDiagnostics.success ? existingDiagnostics.data : null;
  const finishReason = existing?.finishReason ?? stringOrNull(source.finishReason);
  const errorName = stringOrNull(error?.name);
  const rawErrorMessage = stringOrNull(error?.message);
  const response = 'response' in source ? source.response : undefined;
  const providerMetadata = 'providerMetadata' in source ? source.providerMetadata : undefined;
  const failureKind =
    classifyAiProviderFailure({
      errorName: errorName ?? existing?.errorName ?? null,
      errorMessage: rawErrorMessage ?? existing?.errorMessage ?? null,
      finishReason,
    }) ??
    existing?.failureKind ??
    null;
  const errorMessage = rawErrorMessage
    ? safeAiProviderDiagnosticErrorMessage({ failureKind, message: rawErrorMessage })
    : (existing?.errorMessage ?? null);
  const diagnostics = {
    finishReason,
    rawFinishReason: existing?.rawFinishReason ?? stringOrNull(source.rawFinishReason),
    usage: existing?.usage ?? extractTokenUsage(source.usage),
    warningCount: existing?.warningCount ?? warningCount(source.warnings),
    warnings: existing?.warnings ?? summarizeWarnings(source.warnings),
    responseId: existing?.responseId ?? responseField(response, 'id'),
    responseModelId: existing?.responseModelId ?? responseField(response, 'modelId'),
    providerMetadataKeys: existing?.providerMetadataKeys ?? providerMetadataKeys(providerMetadata),
    reasoningEnabled: existing?.reasoningEnabled ?? null,
    reasoningEffort: existing?.reasoningEffort ?? null,
    reasoningRequestedEffort: existing?.reasoningRequestedEffort ?? null,
    reasoningEffectiveEffort: existing?.reasoningEffectiveEffort ?? null,
    reasoningFallbackUsed: existing?.reasoningFallbackUsed ?? false,
    reasoningFallbackReason: existing?.reasoningFallbackReason ?? null,
    errorName: errorName ?? existing?.errorName ?? null,
    errorMessage,
    failureKind,
  };

  return aiProviderDiagnosticsSchema.parse(diagnostics);
}

function classifyAiProviderFailure({
  errorName,
  errorMessage,
  finishReason,
}: {
  errorName: string | null;
  errorMessage: string | null;
  finishReason: string | null;
}): AiProviderFailureKind | null {
  const normalized = `${errorName ?? ''} ${errorMessage ?? ''}`.toLowerCase();
  if (!normalized.trim()) {
    return null;
  }

  if (normalized.includes('api key') || normalized.includes('base url') || normalized.includes('keychain')) {
    return 'missing_config';
  }

  if (normalized.includes('timed out') || normalized.includes('timeout')) {
    return 'timeout';
  }

  if (normalized.includes('nooutput') || normalized.includes('no output generated')) {
    return 'no_output';
  }

  if (normalized.includes('invalid json') || normalized.includes('provider json')) {
    return 'invalid_json';
  }

  if (
    normalized.includes('zoderror') ||
    normalized.includes('typevalidationerror') ||
    normalized.includes('validation')
  ) {
    return 'validation_failed';
  }

  if (finishReason === 'length') {
    return 'length';
  }

  return 'provider_error';
}

function extractTokenUsage(usage: unknown): AiProviderTokenUsage | null {
  const usageRecord = toRecord(usage);
  if (!usageRecord) {
    return null;
  }

  const outputTokenDetails = toRecord(usageRecord.outputTokenDetails);
  const inputTokenDetails = toRecord(usageRecord.inputTokenDetails);

  return {
    inputTokens: numberOrNull(usageRecord.inputTokens),
    outputTokens: numberOrNull(usageRecord.outputTokens),
    totalTokens: numberOrNull(usageRecord.totalTokens),
    reasoningTokens: numberOrNull(usageRecord.reasoningTokens) ?? numberOrNull(outputTokenDetails?.reasoningTokens),
    textTokens: numberOrNull(outputTokenDetails?.textTokens),
    cachedInputTokens: numberOrNull(usageRecord.cachedInputTokens) ?? numberOrNull(inputTokenDetails?.cacheReadTokens),
  };
}

function warningCount(warnings: unknown): number {
  return Array.isArray(warnings) ? warnings.length : 0;
}

function summarizeWarnings(warnings: unknown): string[] {
  if (!Array.isArray(warnings)) {
    return [];
  }

  return warnings
    .map((warning) => summarizeWarning(warning))
    .filter((warning) => warning.length > 0)
    .slice(0, 5);
}

function summarizeWarning(warning: unknown): string {
  if (typeof warning === 'string') {
    return 'Provider warning.';
  }

  const record = toRecord(warning);
  if (!record) {
    return 'Provider warning.';
  }

  const parts = [record.type, record.setting]
    .map((part) => stringOrNull(part))
    .filter((part): part is string => Boolean(part));
  return sanitizeAiProviderDiagnosticText(parts.length > 0 ? parts.join(': ') : 'Provider warning.');
}

function responseField(response: unknown, key: 'id' | 'modelId'): string | null {
  const responseRecord = toRecord(response);
  return responseRecord ? stringOrNull(responseRecord[key]) : null;
}

function providerMetadataKeys(providerMetadata: unknown): string[] {
  const metadataRecord = toRecord(providerMetadata);
  return metadataRecord ? Object.keys(metadataRecord).slice(0, 10) : [];
}

function addReasoningDiagnostics(
  diagnostics: AiProviderDiagnostics,
  providerOptions: ProviderOptions | undefined,
  reasoningFallback: AiGenerationReasoningFallback,
): AiProviderDiagnostics {
  const reasoningEffort = extractOpenAiReasoningEffort(providerOptions);
  if (!reasoningEffort) {
    return diagnostics;
  }

  if (reasoningFallback.used) {
    const fallbackReason = reasoningFallback.reason
      ? sanitizeAiProviderDiagnosticText(reasoningFallback.reason)
      : 'Provider rejected requested reasoning settings; fallback was used.';
    return aiProviderDiagnosticsSchema.parse({
      ...diagnostics,
      warningCount: diagnostics.warningCount + 1,
      warnings: [fallbackReason, ...diagnostics.warnings].slice(0, 5),
      reasoningEnabled: null,
      reasoningEffort: null,
      reasoningRequestedEffort: reasoningEffort,
      reasoningEffectiveEffort: null,
      reasoningFallbackUsed: true,
      reasoningFallbackReason: fallbackReason,
    });
  }

  return aiProviderDiagnosticsSchema.parse({
    ...diagnostics,
    reasoningEnabled: reasoningEffort !== 'none',
    reasoningEffort,
    reasoningRequestedEffort: reasoningEffort,
    reasoningEffectiveEffort: reasoningEffort,
    reasoningFallbackUsed: false,
    reasoningFallbackReason: null,
  });
}

function extractOpenAiReasoningEffort(providerOptions: ProviderOptions | undefined): AiReasoningEffort | null {
  const openAiOptions = toRecord(providerOptions?.openai);
  const parseResult = aiReasoningEffortSchema.safeParse(openAiOptions?.reasoningEffort);
  return parseResult.success ? parseResult.data : null;
}

function shouldRetryWithoutReasoningEffortNone(error: unknown, providerOptions: ProviderOptions | undefined): boolean {
  if (extractOpenAiReasoningEffort(providerOptions) !== 'none') {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase().replace(/[`'"]/g, '');
  return (
    normalized.includes('reasoning_effort') &&
    normalized.includes('unknown variant none') &&
    normalized.includes('expected one of')
  );
}

function removeOpenAiReasoningEffort(providerOptions: ProviderOptions | undefined): ProviderOptions | undefined {
  const optionsRecord = toRecord(providerOptions);
  if (!optionsRecord) {
    return undefined;
  }

  const nextOptions: Record<string, unknown> = { ...optionsRecord };
  const openAiOptions = toRecord(nextOptions.openai);
  if (!openAiOptions) {
    return providerOptions;
  }

  const nextOpenAiOptions: Record<string, unknown> = { ...openAiOptions };
  delete nextOpenAiOptions.reasoningEffort;
  if (Object.keys(nextOpenAiOptions).length > 0) {
    nextOptions.openai = nextOpenAiOptions;
  } else {
    delete nextOptions.openai;
  }

  return Object.keys(nextOptions).length > 0 ? (nextOptions as ProviderOptions) : undefined;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}
