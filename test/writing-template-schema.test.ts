import { describe, expect, it } from 'vitest';
import { writingTemplateSchema } from '../src/shared/types/writing';
import { WRITING_TEMPLATES } from '../src/shared/writing/templates';
import type { WritingTemplate } from '../src/shared/types/writing';

describe('writing template schema', () => {
  it('accepts all built-in templates with non-empty track guidance', () => {
    for (const template of WRITING_TEMPLATES) {
      expect(writingTemplateSchema.safeParse(template).success).toBe(true);
      expect(template.trackGuidance).toMatchObject({
        starterPromptFocus: expect.any(String),
        reviewLens: expect.any(String),
        rewritePracticeFocus: expect.any(String),
      });
      expect(template.trackGuidance?.starterPromptFocus.trim()).not.toBe('');
      expect(template.trackGuidance?.reviewLens.trim()).not.toBe('');
      expect(template.trackGuidance?.rewritePracticeFocus.trim()).not.toBe('');
    }
  });

  it('keeps track guidance optional but rejects blank guidance fields when present', () => {
    const baseTemplate: WritingTemplate = {
      id: 'journal',
      title: 'Journal',
      description: 'A plain writing template.',
      starterPromptBehavior: 'Generate a prompt.',
      reviewFocus: 'Review one useful pattern.',
    };

    expect(writingTemplateSchema.safeParse(baseTemplate).success).toBe(true);
    expect(
      writingTemplateSchema.safeParse({
        ...baseTemplate,
        trackGuidance: {
          starterPromptFocus: ' ',
          reviewLens: 'Review with a track lens.',
          rewritePracticeFocus: 'Practice one repair.',
        },
      }).success,
    ).toBe(false);
  });
});
