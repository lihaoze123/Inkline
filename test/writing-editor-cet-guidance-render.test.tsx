import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WritingEditorCard } from '../src/renderer/components/WritingEditorCard';
import type { WritingTemplateId } from '../src/shared/types/writing';
import { getWritingTemplate, WRITING_TEMPLATES } from '../src/shared/writing/templates';

function renderWritingEditor(templateId: WritingTemplateId): string {
  return renderToStaticMarkup(
    <WritingEditorCard
      template={getWritingTemplate(templateId)}
      templates={WRITING_TEMPLATES}
      selectedTemplateId={templateId}
      generatedPrompt={null}
      userGoal=""
      isStarterPromptVisible={true}
      starterPromptState="idle"
      starterPromptError={null}
      content=""
      lastAutosaveAt={null}
      saveState="idle"
      saveError={null}
      onSelectTemplate={() => undefined}
      onContentChange={() => undefined}
      onUserGoalChange={() => undefined}
      onGenerateStarterPrompt={() => undefined}
      onSkipStarterPrompt={() => undefined}
    />,
  );
}

describe('WritingEditorCard CET guidance', () => {
  it('renders compact CET-4 drafting guidance', () => {
    const html = renderWritingEditor('cet4');

    expect(html).toContain('data-e2e="cet-practice-guidance"');
    expect(html).toContain('Shape a concise everyday response before you draft.');
    expect(html).toContain('Clear position');
    expect(html).toContain('Simple organization');
  });

  it('renders distinct CET-6 drafting guidance', () => {
    const html = renderWritingEditor('cet6');

    expect(html).toContain('data-e2e="cet-practice-guidance"');
    expect(html).toContain('Build a clear argument with visible reasoning.');
    expect(html).toContain('Coherent progression');
    expect(html).toContain('Precise expression pattern');
  });

  it.each(['journal', 'free'] as const)('does not render CET guidance for %s', (templateId) => {
    const html = renderWritingEditor(templateId);

    expect(html).not.toContain('data-e2e="cet-practice-guidance"');
    expect(html).not.toContain('Shape a concise everyday response before you draft.');
    expect(html).not.toContain('Build a clear argument with visible reasoning.');
    expect(html).not.toContain('CET topic');
  });

  it('keeps the CET guidance free of exam-mode wording', () => {
    const html = `${renderWritingEditor('cet4')} ${renderWritingEditor('cet6')}`;

    expect(html).not.toMatch(/\b(timer|timed|score|scores|official)\b/i);
    expect(html).not.toMatch(/\bword[- ]count\b/i);
    expect(html).not.toMatch(/\bmock[- ]exam\b/i);
    expect(html).not.toMatch(/\brubric score\b/i);
  });

  it('keeps all templates available in the editor switcher', () => {
    const html = renderWritingEditor('cet4');

    expect(html).toContain('Journal');
    expect(html).toContain('CET-4 Writing');
    expect(html).toContain('CET-6 Writing');
    expect(html).toContain('Free Writing');
  });
});
