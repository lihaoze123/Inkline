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
    <section className="flex min-h-0 flex-col rounded-[2rem] border border-base-300/80 bg-base-100/95 p-5 shadow-2xl shadow-primary/5" aria-labelledby="writing-editor-title">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Writing editor</p>
          <h2 id="writing-editor-title" className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{template.title}</h2>
          <p className="mt-2 text-sm text-base-content/55">Spellcheck is off on purpose: write independently now, review later.</p>
        </div>
        <AutosaveStatus state={saveState} lastAutosaveAt={lastAutosaveAt} error={saveError} />
      </div>

      <div className="mb-4 grid gap-3 rounded-2xl border border-base-300 bg-base-200/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Starter prompt/topic</p>
            <p className="mt-1 text-sm text-base-content/60">Use AI for a starter topic, regenerate before writing, or skip and write from your own goal.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm rounded-2xl" disabled={starterPromptState === 'generating'} onClick={onGenerateStarterPrompt}>
              {starterPromptState === 'generating' ? <><span className="loading loading-spinner loading-xs" />Generating...</> : generatedPrompt ? 'Regenerate' : 'Generate starter'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm rounded-2xl" onClick={onSkipStarterPrompt}>Skip generation</button>
          </div>
        </div>
        {generatedPrompt ? <p className="rounded-2xl bg-base-100 p-3 text-sm leading-6 text-base-content/75">{generatedPrompt.text}</p> : null}
        <label className="form-control">
          <span className="label-text text-sm font-medium">Optional goal/topic for review context</span>
          <input
            className="input input-bordered mt-2 w-full rounded-2xl"
            value={userGoal}
            onChange={(event) => onUserGoalChange(event.target.value)}
            placeholder="Example: practice giving reasons, describing a memory, or responding to a CET topic."
          />
        </label>
        {starterPromptError ? <div className="alert alert-error py-2 text-sm"><span>{starterPromptError}</span><button type="button" className="btn btn-error btn-xs" onClick={onGenerateStarterPrompt}>Retry</button></div> : null}
      </div>

      {highlightedContent ? (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Reviewed highlights</p>
          <HighlightedWriting content={highlightedContent} corrections={highlightedCorrections} />
        </div>
      ) : null}

      <textarea
        className="textarea textarea-ghost writing-practice-surface min-h-[28rem] flex-1 resize-none rounded-[1.5rem] border border-base-300 bg-base-200/45 p-6 text-[1.08rem] leading-8 shadow-inner outline-none transition focus:border-primary/60 focus:bg-base-100 lg:min-h-0"
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="Write in English for this practice scenario. No redlines, no corrections while you write."
        aria-label={`${template.title} writing practice editor`}
        spellCheck={false}
      />
    </section>
  );
}
