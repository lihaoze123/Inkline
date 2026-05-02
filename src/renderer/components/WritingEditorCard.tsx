import { AutosaveStatus } from './AutosaveStatus';
import type { WritingEditorCardProps } from './types';

export function WritingEditorCard({
  template,
  templates,
  selectedTemplateId,
  generatedPrompt,
  userGoal,
  isStarterPromptVisible,
  starterPromptState,
  starterPromptError,
  content,
  lastAutosaveAt,
  saveState,
  saveError,
  onSelectTemplate,
  onContentChange,
  onUserGoalChange,
  onGenerateStarterPrompt,
  onSkipStarterPrompt,
}: WritingEditorCardProps): React.JSX.Element {
  return (
    <section className="flex min-h-0 flex-col" aria-labelledby="writing-editor-title">
      {isStarterPromptVisible ? (
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
                <p className="max-w-3xl text-sm leading-6 text-base-content/70">{generatedPrompt.text}</p>
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
              <button
                type="button"
                className="btn btn-outline btn-error btn-xs ml-3 rounded-lg"
                onClick={onGenerateStarterPrompt}
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1 pb-2 text-xs text-base-content/38 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <details className="group relative text-base-content/45">
            <summary className="flex cursor-pointer list-none items-center gap-2 transition hover:text-base-content/70 [&::-webkit-details-marker]:hidden">
              <span>{template.title}</span>
              <span className="text-primary/70 group-open:hidden">Change</span>
              <span className="hidden text-primary/70 group-open:inline">Close</span>
            </summary>
            <div className="absolute left-0 z-20 mt-2 grid min-w-36 gap-2 rounded-xl border border-base-300 bg-base-100 p-3 shadow-sm">
              {templates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={`text-left transition ${candidate.id === selectedTemplateId ? 'font-semibold text-primary' : 'hover:text-base-content'}`}
                  onClick={() => onSelectTemplate(candidate.id)}
                >
                  {candidate.title}
                </button>
              ))}
            </div>
          </details>
          <span aria-hidden="true" className="text-base-content/25">
            |
          </span>
          <h2 id="writing-editor-title" className="font-normal">
            Draft
          </h2>
        </div>
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
