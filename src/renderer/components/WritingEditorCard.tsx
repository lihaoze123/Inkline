import { AutosaveStatus } from './AutosaveStatus';
import { HighlightedWriting } from './review-utils';
import type { WritingEditorCardProps } from './types';

export function WritingEditorCard({
  template,
  generatedPrompt,
  userGoal,
  starterPromptState,
  starterPromptError,
  content,
  lastAutosaveAt,
  saveState,
  saveError,
  highlightedContent,
  highlightedCorrections,
  onContentChange,
  onUserGoalChange,
  onGenerateStarterPrompt,
  onSkipStarterPrompt,
}: WritingEditorCardProps): React.JSX.Element {
  return (
    <section className="flex min-h-0 flex-col" aria-labelledby="writing-editor-title">
      <div className="flex flex-col gap-4 border-b border-base-300/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="writing-editor-title" className="text-base font-medium text-base-content/78">
            Untitled Draft
          </h2>
          <span className="inline-icon text-base-content/48" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </span>
          <span className="text-xs text-base-content/50">{template.title}</span>
        </div>
        <AutosaveStatus state={saveState} lastAutosaveAt={lastAutosaveAt} error={saveError} />
      </div>

      <div className="grid gap-4 border-b border-base-300/55 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
              Need a starting point?
            </p>
            <p className="mt-1 text-sm leading-6 text-base-content/60">
              Generate a starter topic, skip it, or write from your own intention.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm rounded-xl"
              disabled={starterPromptState === 'generating'}
              onClick={onGenerateStarterPrompt}
            >
              {starterPromptState === 'generating' ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Preparing...
                </>
              ) : generatedPrompt ? (
                'Regenerate'
              ) : (
                'Generate starter'
              )}
            </button>
            <button type="button" className="btn btn-ghost btn-sm rounded-xl" onClick={onSkipStarterPrompt}>
              Skip
            </button>
          </div>
        </div>
        {generatedPrompt ? (
          <p className="border-l border-base-300/70 pl-4 text-sm leading-6 text-base-content/70">
            {generatedPrompt.text}
          </p>
        ) : null}
        <label className="form-control">
          <span className="label-text text-sm font-medium text-base-content/70">
            Optional goal/topic for review context
          </span>
          <input
            className="input input-bordered mt-2 w-full bg-base-100/55"
            value={userGoal}
            onChange={(event) => onUserGoalChange(event.target.value)}
            placeholder="Example: practice giving reasons, describing a memory, or responding to a CET topic."
          />
        </label>
        {starterPromptError ? (
          <div className="alert alert-error py-2 text-sm">
            <span>{starterPromptError}</span>
            <button type="button" className="btn btn-error btn-xs" onClick={onGenerateStarterPrompt}>
              Retry
            </button>
          </div>
        ) : null}
      </div>

      {highlightedContent ? (
        <div className="mb-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Reviewed highlights</p>
          <HighlightedWriting content={highlightedContent} corrections={highlightedCorrections} />
        </div>
      ) : null}

      <textarea
        className="writing-practice-surface paper-sheet mt-5 min-h-[34rem] flex-1 resize-none p-10 text-base-content outline-none transition placeholder:text-base-content/35 focus:border-primary/35 lg:min-h-0"
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="Write in English. No corrections while you write."
        aria-label={`${template.title} writing practice editor`}
        spellCheck={false}
      />
      <div className="mt-4 flex items-center justify-between border-t border-base-300/55 py-4 text-sm text-base-content/52">
        <span>{content.trim().split(/\s+/).filter(Boolean).length} words</span>
        <span>Write first. Feedback later.</span>
      </div>
    </section>
  );
}
