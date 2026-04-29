import { AutosaveStatus } from './AutosaveStatus';
import { HighlightedJournal } from './review-utils';
import type { JournalEditorCardProps } from './types';

export function JournalEditorCard({
  content,
  lastAutosaveAt,
  saveState,
  saveError,
  highlightedContent,
  highlightedCorrections,
  onContentChange,
}: JournalEditorCardProps): React.JSX.Element {
  return (
    <section className="flex min-h-0 flex-col rounded-[2rem] border border-base-300/80 bg-base-100/95 p-5 shadow-2xl shadow-primary/5" aria-labelledby="journal-editor-title">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Journal editor</p>
          <h2 id="journal-editor-title" className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Today's journal</h2>
          <p className="mt-2 text-sm text-base-content/55">Spellcheck is off on purpose: write freely now, review later.</p>
        </div>
        <AutosaveStatus state={saveState} lastAutosaveAt={lastAutosaveAt} error={saveError} />
      </div>

      {highlightedContent ? (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Reviewed highlights</p>
          <HighlightedJournal content={highlightedContent} corrections={highlightedCorrections} />
        </div>
      ) : null}

      <textarea
        className="textarea textarea-ghost journal-writing-surface min-h-[28rem] flex-1 resize-none rounded-[1.5rem] border border-base-300 bg-base-200/45 p-6 text-[1.08rem] leading-8 shadow-inner outline-none transition focus:border-primary/60 focus:bg-base-100 lg:min-h-0"
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="Write about your day in English. No redlines, no corrections while you write."
        aria-label="Today's English journal"
        spellCheck={false}
      />
    </section>
  );
}
