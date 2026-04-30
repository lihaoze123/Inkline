import { generateText, Output } from 'ai';
import type { FlexibleSchema } from 'ai';
import { aiGenerationRequestSchema, aiGenerationResultSchema, aiProviderRuntimeConfigSchema } from './types';
import type { AiGenerationRequest, AiGenerationResult, AiProviderRuntimeConfig } from './types';
import { createAiProviderModel } from './provider';

export async function generateStructuredObject<Output>(input: AiGenerationRequest & {
  runtimeConfig: AiProviderRuntimeConfig;
  schema: FlexibleSchema<Output>;
  schemaName: string;
  schemaDescription?: string;
}): Promise<AiGenerationResult & { output: Output }> {
  const parsedRequest = aiGenerationRequestSchema.parse(input);
  const runtimeConfig = aiProviderRuntimeConfigSchema.parse(input.runtimeConfig);
  const providerModel = createAiProviderModel(runtimeConfig);
  const result = await generateText({
    model: providerModel.languageModel,
    system: parsedRequest.systemPrompt,
    prompt: parsedRequest.userPrompt,
    output: Output.object({
      schema: input.schema,
      name: input.schemaName,
      description: input.schemaDescription,
    }),
    temperature: parsedRequest.temperature,
    maxOutputTokens: parsedRequest.maxOutputTokens,
    maxRetries: parsedRequest.maxRetries ?? 0,
    timeout: parsedRequest.timeoutMs,
  });
  const generationResult = aiGenerationResultSchema.parse({
    output: result.output,
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
    output: result.output,
  };
}
