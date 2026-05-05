import type { WritingTemplate, WritingTemplateId } from '../types/writing';

export const WRITING_TEMPLATES: WritingTemplate[] = [
  {
    id: 'journal',
    title: 'Journal',
    description: 'Reflect on a real moment from your day and turn it into clear English.',
    starterPromptBehavior: 'Generate a reflective English journal prompt.',
    reviewFocus: 'Daily expression, natural sentence flow, and one reusable language pattern.',
  },
  {
    id: 'cet4',
    title: 'CET-4 Writing',
    description: 'Practice a concise CET-4-style response with a clear everyday topic.',
    starterPromptBehavior: 'Generate a focused CET-4 writing topic in English.',
    reviewFocus: 'Task response, organization, clarity, and one high-value CET-4 language pattern.',
    scenarioContext: 'CET-4',
  },
  {
    id: 'cet6',
    title: 'CET-6 Writing',
    description: 'Develop a clear CET-6-style argument as focused writing practice.',
    starterPromptBehavior: 'Generate a focused CET-6 writing topic in English.',
    reviewFocus: 'Argument clarity, coherence, precise expression, and one high-value CET-6 language pattern.',
    scenarioContext: 'CET-6',
  },
  {
    id: 'free',
    title: 'Free Writing',
    description: 'Shape your own topic or intention into a clear English paragraph.',
    starterPromptBehavior: 'Generate an open-ended English prompt that follows the user goal when present.',
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
