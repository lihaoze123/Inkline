import { reviewAgentResponseSchema, type ReviewAgent } from '../types';

export const callPiMonoReviewAgent: ReviewAgent = async () => {
  throw new Error('pi-mono review agent is not configured.');
};

export function parseReviewAgentJson(rawOutput: string): ReturnType<typeof reviewAgentResponseSchema.parse> {
  return reviewAgentResponseSchema.parse({
    output: JSON.parse(rawOutput) as unknown,
    rawOutput,
  });
}
