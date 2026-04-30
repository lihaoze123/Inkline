import type { WritingTemplate, WritingTemplateId } from '../types/writing';

export const WRITING_TEMPLATES: WritingTemplate[] = [
  {
    id: 'journal',
    title: 'Journal',
    description: 'Reflect on your day, thoughts, or experiences while keeping the existing habit-writing use case.',
    starterPromptBehavior: 'Generate a reflective English journaling prompt.',
    reviewFocus: 'Clear daily expression, natural sentence flow, and transferable grammar or collocation patterns.',
  },
  {
    id: 'cet4',
    title: 'CET-4 Writing',
    description: 'Practice a short CET-4-style writing task without timer or score pressure.',
    starterPromptBehavior: 'Generate an English CET-4 writing topic with concise Chinese helper copy.',
    reviewFocus: 'Task response, organization, clarity, and high-value language patterns for CET-4 writing.',
    scenarioContext: 'CET-4',
  },
  {
    id: 'cet6',
    title: 'CET-6 Writing',
    description: 'Practice a CET-6-style writing task as focused writing practice, not a mock exam.',
    starterPromptBehavior: 'Generate an English CET-6 writing topic with concise Chinese helper copy.',
    reviewFocus: 'Argument clarity, coherence, precise expression, and high-value language patterns for CET-6 writing.',
    scenarioContext: 'CET-6',
  },
  {
    id: 'free',
    title: 'Free Writing',
    description: 'Write from your own topic or intention, with optional AI topic inspiration.',
    starterPromptBehavior: 'Generate an open-ended English writing prompt that adapts to the user goal when present.',
    reviewFocus: 'User intention, clarity, natural expression, and one reusable improvement pattern.',
  },
];

export function getWritingTemplate(templateId: WritingTemplateId): WritingTemplate {
  const template = WRITING_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    return WRITING_TEMPLATES[0];
  }
  return template;
}
