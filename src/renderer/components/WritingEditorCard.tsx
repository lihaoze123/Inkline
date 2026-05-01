import { AutosaveStatus } from './AutosaveStatus';
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
  onContentChange,
  onUserGoalChange,
  onGenerateStarterPrompt,
  onSkipStarterPrompt,
}: WritingEditorCardProps): React.JSX.Element {
  return (
    <section className="flex min-h-0 flex-col" aria-labelledby="writing-editor-title">
      <div className="flex flex-col gap-3 pb-3 text-sm text-base-content/58">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="leading-6 text-base-content/55">Need a starting point?</p>
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

        <details className="group text-sm text-base-content/58">
          <summary className="cursor-pointer select-none text-xs text-base-content/45 transition hover:text-base-content/70">
            Starter prompt and optional goal
          </summary>
          <div className="mt-4 grid gap-4">
            {generatedPrompt ? (
              <p className="max-w-3xl text-sm leading-6 text-base-content/70">
                {generatedPrompt.text}
              </p>
            ) : (
              <p className="max-w-xl text-sm leading-6 text-base-content/50">
                Generate a starter topic, skip it, or write from your own intention.
              </p>
            )}
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
          </div>
        </details>
        {starterPromptError ? (
          <div className="border-l border-error/40 py-1 pl-4 text-sm leading-6 text-error">
            <span>{starterPromptError}</span>
            <button type="button" className="btn btn-outline btn-error btn-xs ml-3 rounded-lg" onClick={onGenerateStarterPrompt}>
              Retry
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 pb-2 text-xs text-base-content/38 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="writing-editor-title" className="font-normal">
          Draft
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <AutosaveStatus state={saveState} lastAutosaveAt={lastAutosaveAt} error={saveError} />
          <span>{content.trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>
      </div>

      <textarea
        className="writing-practice-surface paper-sheet mt-4 min-h-[38rem] flex-1 resize-none p-10 text-base-content outline-none transition placeholder:text-base-content/35 focus:border-primary/35 lg:min-h-0"
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="Write in English. No corrections while you write."
        aria-label={`${template.title} writing practice editor`}
        spellCheck={false}
      />
      <p className="mt-3 py-1 text-right text-xs text-base-content/35">Write first. Feedback later.</p>
    </section>
  );
}
