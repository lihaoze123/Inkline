import type { WritingTemplate, WritingTemplateId } from '../types/writing';

export const WRITING_TEMPLATES: WritingTemplate[] = [
  {
    id: 'journal',
    title: 'Journal',
    description: 'Reflect on a real moment from your day and turn it into clear English.',
    starterPromptBehavior: 'Generate a reflective English journal prompt.',
    reviewFocus: 'Daily expression, natural sentence flow, and one reusable language pattern.',
    trackGuidance: {
      starterPromptFocus: 'Frame a reflective daily-life prompt around a real moment and natural English expression.',
      reviewLens:
        'Prioritize reflective daily expression, natural sentence flow, and one transferable everyday pattern.',
      rewritePracticeFocus:
        'Phrase the D+1 rewrite as everyday sentence repair that helps reuse the same natural expression pattern.',
    },
  },
  {
    id: 'cet4',
    title: 'CET-4 Writing',
    description: 'Practice a concise CET-4-style response with a clear everyday topic.',
    starterPromptBehavior: 'Generate a focused CET-4 writing topic in English.',
    reviewFocus: 'Task response, organization, clarity, and one high-value CET-4 language pattern.',
    scenarioContext: 'CET-4',
    trackGuidance: {
      starterPromptFocus:
        'Frame a concise everyday CET-4-style topic with a clear position and simple organization, without exam pressure.',
      reviewLens:
        'Prioritize clear task response, simple organization, accurate expression, and one reusable CET-4 pattern.',
      rewritePracticeFocus:
        'Phrase the D+1 rewrite as concise original-sentence repair for one accurate reusable pattern.',
    },
  },
  {
    id: 'cet6',
    title: 'CET-6 Writing',
    description: 'Develop a clear CET-6-style argument as focused writing practice.',
    starterPromptBehavior: 'Generate a focused CET-6 writing topic in English.',
    reviewFocus: 'Argument clarity, coherence, precise expression, and one high-value CET-6 language pattern.',
    scenarioContext: 'CET-6',
    trackGuidance: {
      starterPromptFocus:
        'Frame a CET-6-style argumentative topic that invites clear reasoning, coherent progression, and useful evidence.',
      reviewLens:
        'Prioritize argument clarity, coherent progression, useful evidence or reasoning, and one precise expression pattern.',
      rewritePracticeFocus:
        'Phrase the D+1 rewrite as argument-focused original-sentence repair for the precise expression pattern.',
    },
  },
  {
    id: 'free',
    title: 'Free Writing',
    description: 'Shape your own topic or intention into a clear English paragraph.',
    starterPromptBehavior: 'Generate an open-ended English prompt that follows the user goal when present.',
    reviewFocus: 'User intention, clarity, natural expression, and one reusable improvement pattern.',
    trackGuidance: {
      starterPromptFocus:
        "Frame an open-ended prompt around the user's intention or practical scenario while keeping the writing user-authored.",
      reviewLens:
        "Prioritize the user's intention, practical scenario fit, natural expression, and one reusable pattern.",
      rewritePracticeFocus:
        "Phrase the D+1 rewrite as practical original-sentence repair for the learner's chosen scenario.",
    },
  },
];

export function getWritingTemplate(templateId: WritingTemplateId): WritingTemplate {
  const template = WRITING_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    return WRITING_TEMPLATES[0];
  }
  return template;
}
