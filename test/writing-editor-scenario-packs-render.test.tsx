import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FREE_WRITING_SCENARIO_PACKS, WritingEditorCard } from '../src/renderer/components/WritingEditorCard';
import type { WritingEditorCardProps } from '../src/renderer/components/types';
import type { WritingTemplateId } from '../src/shared/types/writing';
import { getWritingTemplate, WRITING_TEMPLATES } from '../src/shared/writing/templates';

type ElementWithChildren = {
  children?: ReactNode;
};

type ButtonElementProps = ElementWithChildren & {
  onClick?: () => void;
};

function makeWritingEditorProps(
  templateId: WritingTemplateId,
  overrides: Partial<WritingEditorCardProps> = {},
): WritingEditorCardProps {
  return {
    template: getWritingTemplate(templateId),
    templates: WRITING_TEMPLATES,
    selectedTemplateId: templateId,
    generatedPrompt: null,
    userGoal: '',
    isStarterPromptVisible: true,
    starterPromptState: 'idle',
    starterPromptError: null,
    content: '',
    lastAutosaveAt: null,
    saveState: 'idle',
    saveError: null,
    onSelectTemplate: () => undefined,
    onContentChange: () => undefined,
    onUserGoalChange: () => undefined,
    onGenerateStarterPrompt: () => undefined,
    onSkipStarterPrompt: () => undefined,
    ...overrides,
  };
}

function makeWritingEditorElement(
  templateId: WritingTemplateId,
  overrides: Partial<WritingEditorCardProps> = {},
): React.JSX.Element {
  return WritingEditorCard(makeWritingEditorProps(templateId, overrides));
}

function renderWritingEditor(templateId: WritingTemplateId, userGoal = ''): string {
  return renderToStaticMarkup(makeWritingEditorElement(templateId, { userGoal }));
}

function flattenText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(flattenText).join('');
  }

  if (isValidElement<ElementWithChildren>(node)) {
    return flattenText(node.props.children);
  }

  return '';
}

function findButtonByText(node: ReactNode, label: string): ReactElement<ButtonElementProps> | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<ButtonElementProps>(child)) {
      continue;
    }

    if (child.type === 'button' && flattenText(child.props.children) === label) {
      return child;
    }

    const nestedButton = findButtonByText(child.props.children, label);
    if (nestedButton) {
      return nestedButton;
    }
  }

  return null;
}

function getGoalSeed(label: string): string {
  const pack = FREE_WRITING_SCENARIO_PACKS.find((candidate) => candidate.label === label);
  if (!pack) {
    throw new Error(`Unknown scenario pack: ${label}`);
  }

  return pack.goalSeed;
}

describe('WritingEditorCard scenario packs', () => {
  it('renders all Free Writing scenario pack chips', () => {
    const html = renderWritingEditor('free');

    expect(html).toContain('data-e2e="free-writing-scenario-packs"');
    for (const pack of FREE_WRITING_SCENARIO_PACKS) {
      expect(html).toContain(pack.label);
    }
  });

  it.each(['journal', 'cet4', 'cet6'] as const)('does not render scenario packs for %s', (templateId) => {
    const html = renderWritingEditor(templateId);

    expect(html).not.toContain('data-e2e="free-writing-scenario-packs"');
    for (const pack of FREE_WRITING_SCENARIO_PACKS) {
      expect(html).not.toContain(pack.label);
    }
  });

  it('selecting a scenario updates the existing Practice goal value path only', () => {
    const onUserGoalChange = vi.fn();
    const onGenerateStarterPrompt = vi.fn();
    const element = makeWritingEditorElement('free', {
      onUserGoalChange,
      onGenerateStarterPrompt,
    });
    const travelButton = findButtonByText(element, 'Travel');

    if (!travelButton?.props.onClick) {
      throw new Error('Travel scenario chip was not found.');
    }

    travelButton.props.onClick();

    expect(onUserGoalChange).toHaveBeenCalledTimes(1);
    expect(onUserGoalChange).toHaveBeenCalledWith(getGoalSeed('Travel'));
    expect(onGenerateStarterPrompt).not.toHaveBeenCalled();
  });

  it('keeps the existing user goal as the controlled input value', () => {
    const html = renderWritingEditor('free', 'Keep my typed goal');

    expect(html).toContain('value="Keep my typed goal"');
  });

  it('keeps scenario pack copy free of generated-writing and exam-mode wording', () => {
    const html = renderWritingEditor('free');
    const scenarioCopy = FREE_WRITING_SCENARIO_PACKS.map((pack) => `${pack.label} ${pack.goalSeed}`).join(' ');
    const copy = `${html} ${scenarioCopy}`;

    expect(copy).not.toMatch(/\b(timer|timed|score|scores|level|levels|rubric|rubrics|official)\b/i);
    expect(copy).not.toMatch(/\bmock[- ]exam\b/i);
    expect(copy).not.toMatch(
      /\b(outline for you|write it for you|written for you|generated essay|generated outline)\b/i,
    );
  });
});
