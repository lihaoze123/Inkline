import type { WritingTemplateId } from '@shared/types/writing';

type CetGuidanceContent = {
  lead: string;
  cues: string[];
};

const CET_GUIDANCE: Partial<Record<WritingTemplateId, CetGuidanceContent>> = {
  cet4: {
    lead: 'Shape a concise everyday response before you draft.',
    cues: ['Clear position', 'Simple organization', 'Accurate reusable pattern'],
  },
  cet6: {
    lead: 'Build a clear argument with visible reasoning.',
    cues: ['Coherent progression', 'Useful evidence', 'Precise expression pattern'],
  },
};

export function CetPracticeGuidance({ templateId }: { templateId: WritingTemplateId }): React.JSX.Element | null {
  const guidance = CET_GUIDANCE[templateId];

  if (!guidance) {
    return null;
  }

  return (
    <div
      className="ui-chrome mt-3 border-l border-base-300/70 pl-4 text-sm leading-6 text-base-content/55"
      role="note"
      aria-label="CET practice guidance"
      data-e2e="cet-practice-guidance"
    >
      <p>{guidance.lead}</p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/42">
        {guidance.cues.map((cue) => (
          <li key={cue}>{cue}</li>
        ))}
      </ul>
    </div>
  );
}
