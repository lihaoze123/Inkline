import type { ReactNode } from 'react';
import type { AnchoredCorrectionOperationSnapshot, ReviewPreviewSnapshot } from '@shared/types/review';
import type { CorrectionCardProps } from './types';

export function getFocusCorrection(preview: ReviewPreviewSnapshot): AnchoredCorrectionOperationSnapshot | null {
  const focusIndex = preview.parsedOutput.summary.focusPattern.correctionIndex;
  const matches = preview.operations.corrections.filter((correction) => correction.correctionIndex === focusIndex && correction.status !== 'low_confidence');
  return matches.length === 1 ? matches[0] : null;
}

export function patternRule(correction: AnchoredCorrectionOperationSnapshot): string | null {
  const suggestion = correction.newPatternSuggestion;
  if (typeof suggestion === 'object' && suggestion !== null && 'rule' in suggestion) {
    const rule = suggestion.rule;
    return typeof rule === 'string' ? rule : null;
  }

  return null;
}

export function HighlightedJournal({ content, corrections }: { content: string; corrections: AnchoredCorrectionOperationSnapshot[] }): React.JSX.Element {
  const anchoredCorrections = corrections
    .filter((correction) => correction.status !== 'low_confidence' && correction.startOffset !== null && correction.endOffset !== null)
    .sort((left, right) => (left.startOffset ?? 0) - (right.startOffset ?? 0));
  const parts: ReactNode[] = [];
  let cursor = 0;

  anchoredCorrections.forEach((correction) => {
    const startOffset = correction.startOffset ?? 0;
    const endOffset = correction.endOffset ?? startOffset;
    if (startOffset < cursor) {
      return;
    }

    parts.push(content.slice(cursor, startOffset));
    parts.push(<mark className="review-highlight" key={`${startOffset}-${endOffset}`}>{content.slice(startOffset, endOffset)}</mark>);
    cursor = endOffset;
  });
  parts.push(content.slice(cursor));

  return (
    <div className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm leading-7 text-base-content/80 scrollable" aria-label="Reviewed text with anchored highlights">
      {parts}
    </div>
  );
}

export function CorrectionCard({ correction, showAnswer, reason }: CorrectionCardProps): React.JSX.Element {
  return (
    <article className={`rounded-2xl border p-4 ${correction.status === 'low_confidence' ? 'border-base-300 border-dashed bg-base-200/70' : 'border-base-300 bg-base-100'}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="badge badge-soft badge-primary">{correction.status === 'low_confidence' ? 'Suggestion' : 'Fix'}</span>
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-base-content/40">{correction.category}</span>
      </div>
      <div className="space-y-3 text-sm leading-6">
        <ReviewField label="Pattern" value={correction.matchedPatternId ?? patternRule(correction) ?? correction.category} />
        <ReviewField label="You wrote" value={correction.originalText} />
        <ReviewField label="Try" value={showAnswer ? correction.correctedText : 'Hidden until you try or reveal.'} strong={showAnswer} />
        <ReviewField label="Why" value={reason ?? correction.explanation} />
      </div>
    </article>
  );
}

function ReviewField({ label, value, strong = false }: { label: string; value: string; strong?: boolean }): React.JSX.Element {
  return (
    <p className="m-0">
      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45">{label}</span>
      <span className={strong ? 'font-semibold text-base-content' : 'text-base-content/75'}>{value}</span>
    </p>
  );
}
