import { callOpenAiCompatibleReviewAgent } from './openai-compatible-agent';
import { reviewAgentResponseSchema, type ReviewAgent } from '../types';

export const callPiMonoReviewAgent: ReviewAgent = callOpenAiCompatibleReviewAgent;

export function parseReviewAgentJson(rawOutput: string): ReturnType<typeof reviewAgentResponseSchema.parse> {
  return reviewAgentResponseSchema.parse({
    output: JSON.parse(rawOutput) as unknown,
    rawOutput,
  });
}
