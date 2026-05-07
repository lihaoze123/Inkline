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

type InputElementProps = ElementWithChildren & {
  checked?: boolean;
  onChange?: (event: { target: { checked: boolean } }) => void;
  'data-e2e'?: string;
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
    hasActivePatternsForStarterPrompt: false,
    useActivePatternsForStarterPrompt: false,
    starterPromptState: 'idle',
    starterPromptError: null,
    content: '',
    lastAutosaveAt: null,
    saveState: 'idle',
    saveError: null,
    onSelectTemplate: () => undefined,
    onContentChange: () => undefined,
    onUserGoalChange: () => undefined,
    onUseActivePatternsForStarterPromptChange: () => undefined,
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

function findInputByDataE2e(node: ReactNode, dataE2e: string): ReactElement<InputElementProps> | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<InputElementProps>(child)) {
      continue;
    }

    if (child.type === 'input' && child.props['data-e2e'] === dataE2e) {
      return child;
    }

    const nestedInput = findInputByDataE2e(child.props.children, dataE2e);
    if (nestedInput) {
      return nestedInput;
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

describe('WritingEditorCard active pattern starter option', () => {
  it('renders the active-pattern option only when active patterns exist', () => {
    const withPatterns = renderToStaticMarkup(
      makeWritingEditorElement('journal', { hasActivePatternsForStarterPrompt: true }),
    );
    const withoutPatterns = renderToStaticMarkup(
      makeWritingEditorElement('journal', { hasActivePatternsForStarterPrompt: false }),
    );

    expect(withPatterns).toContain('data-e2e="starter-active-patterns-control"');
    expect(withPatterns).toContain('Active patterns');
    expect(withoutPatterns).not.toContain('data-e2e="starter-active-patterns-control"');
    expect(withoutPatterns).not.toContain('Active patterns');
  });

  it('keeps toggling local and does not generate a prompt directly', () => {
    const onUseActivePatternsForStarterPromptChange = vi.fn();
    const onGenerateStarterPrompt = vi.fn();
    const element = makeWritingEditorElement('journal', {
      hasActivePatternsForStarterPrompt: true,
      useActivePatternsForStarterPrompt: false,
      onUseActivePatternsForStarterPromptChange,
      onGenerateStarterPrompt,
    });
    const toggle = findInputByDataE2e(element, 'starter-active-patterns-toggle');

    if (!toggle?.props.onChange) {
      throw new Error('Active pattern toggle was not found.');
    }

    toggle.props.onChange({ target: { checked: true } });

    expect(onUseActivePatternsForStarterPromptChange).toHaveBeenCalledTimes(1);
    expect(onUseActivePatternsForStarterPromptChange).toHaveBeenCalledWith(true);
    expect(onGenerateStarterPrompt).not.toHaveBeenCalled();
  });

  it('passes the current active-pattern option when creating a prompt', () => {
    const onGenerateStarterPrompt = vi.fn();
    const element = makeWritingEditorElement('journal', {
      hasActivePatternsForStarterPrompt: true,
      useActivePatternsForStarterPrompt: true,
      onGenerateStarterPrompt,
    });
    const createButton = findButtonByText(element, 'Create prompt');

    if (!createButton?.props.onClick) {
      throw new Error('Create prompt button was not found.');
    }

    createButton.props.onClick();

    expect(onGenerateStarterPrompt).toHaveBeenCalledTimes(1);
    expect(onGenerateStarterPrompt).toHaveBeenCalledWith({ useActivePatterns: true });
  });

  it('passes the current active-pattern option when refreshing a prompt', () => {
    const onGenerateStarterPrompt = vi.fn();
    const element = makeWritingEditorElement('journal', {
      generatedPrompt: { text: 'Write about a useful habit.', generatedAt: 1 },
      hasActivePatternsForStarterPrompt: true,
      useActivePatternsForStarterPrompt: false,
      onGenerateStarterPrompt,
    });
    const refreshButton = findButtonByText(element, 'Refresh prompt');

    if (!refreshButton?.props.onClick) {
      throw new Error('Refresh prompt button was not found.');
    }

    refreshButton.props.onClick();

    expect(onGenerateStarterPrompt).toHaveBeenCalledTimes(1);
    expect(onGenerateStarterPrompt).toHaveBeenCalledWith({ useActivePatterns: false });
  });
});
