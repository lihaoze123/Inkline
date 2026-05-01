import { asSchema, generateText, Output } from 'ai';
import type { FlexibleSchema } from 'ai';
import { aiGenerationRequestSchema, aiGenerationResultSchema, aiProviderRuntimeConfigSchema } from './types';
import type { AiGenerationRequest, AiGenerationResult, AiProviderRuntimeConfig } from './types';
import { createAiProviderModel } from './provider';

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
  const providerModel = createAiProviderModel(runtimeConfig);
  const useJsonObjectMode = providerModel.provider === 'openai-compatible';
  const result = await generateText({
    model: providerModel.languageModel,
    system: await buildSystemPromptWithJsonInstruction({
      systemPrompt: parsedRequest.systemPrompt,
      schema: input.schema,
      schemaName: input.schemaName,
      schemaDescription: input.schemaDescription,
      useJsonObjectMode,
    }),
    prompt: parsedRequest.userPrompt,
    output: useJsonObjectMode
      ? Output.json({ name: input.schemaName, description: input.schemaDescription })
      : Output.object({
          schema: input.schema,
          name: input.schemaName,
          description: input.schemaDescription,
        }),
    temperature: parsedRequest.temperature,
    maxOutputTokens: parsedRequest.maxOutputTokens,
    maxRetries: parsedRequest.maxRetries ?? 0,
    timeout: parsedRequest.timeoutMs,
  });
  const output: OutputObject = useJsonObjectMode
    ? await validateStructuredOutput(result.output, input.schema)
    : (result.output as OutputObject);
  const generationResult = aiGenerationResultSchema.parse({
    output,
    rawOutput: {
      finishReason: result.finishReason,
      usage: result.usage,
      warnings: result.warnings,
      request: result.request,
      response: result.response,
      providerMetadata: result.providerMetadata,
    },
    provider: providerModel.provider,
    model: providerModel.model,
  });

  return {
    ...generationResult,
    output,
  };
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
