import { AutosaveStatus } from './AutosaveStatus';
import { CetPracticeGuidance } from './CetPracticeGuidance';
import type { WritingEditorCardProps } from './types';

type FreeWritingScenarioPack = {
  label: string;
  goalSeed: string;
};

export const FREE_WRITING_SCENARIO_PACKS: readonly FreeWritingScenarioPack[] = [
  {
    label: 'School essay',
    goalSeed: 'Write a short school essay with a clear opinion and one supporting example.',
  },
  {
    label: 'Work update',
    goalSeed: 'Write a brief work update about progress, blockers, and next steps.',
  },
  {
    label: 'Application',
    goalSeed: 'Write an application paragraph explaining your fit and motivation.',
  },
  {
    label: 'Travel',
    goalSeed: 'Write about a travel plan or experience with clear details.',
  },
  {
    label: 'Free expression',
    goalSeed: 'Explore a personal idea in your own voice and keep the point clear.',
  },
];

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
        <div className="ui-chrome flex flex-col gap-3 pb-3 text-sm text-base-content/58">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="leading-6 text-base-content/55">Want a prompt?</p>
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
                    Drafting...
                  </>
                ) : generatedPrompt ? (
                  'Refresh prompt'
                ) : (
                  'Create prompt'
                )}
              </button>
              <button type="button" className="btn btn-ghost btn-sm rounded-xl" onClick={onSkipStarterPrompt}>
                Skip
              </button>
            </div>
          </div>

          <details className="group text-sm text-base-content/58" data-e2e="starter-goal-details">
            <summary
              className="cursor-pointer select-none text-xs text-base-content/45 transition hover:text-base-content/70"
              data-e2e="starter-goal-summary"
            >
              Prompt and goal
            </summary>
            <div className="mt-4 grid gap-4">
              {generatedPrompt ? (
                <p className="selectable-content max-w-3xl text-sm leading-6 text-base-content/70">
                  {generatedPrompt.text}
                </p>
              ) : (
                <p className="max-w-xl text-sm leading-6 text-base-content/50">
                  Create a prompt, add a goal, or begin with your own idea.
                </p>
              )}
              {selectedTemplateId === 'free' ? (
                <div
                  className="flex flex-wrap gap-2"
                  aria-label="Free Writing scenario packs"
                  data-e2e="free-writing-scenario-packs"
                >
                  {FREE_WRITING_SCENARIO_PACKS.map((pack) => (
                    <button
                      key={pack.label}
                      type="button"
                      className="btn btn-ghost btn-xs rounded-lg border border-base-300/60 bg-base-100/35 px-3 font-normal text-base-content/58 transition hover:border-primary/25 hover:bg-base-100/70 hover:text-base-content"
                      onClick={() => onUserGoalChange(pack.goalSeed)}
                    >
                      {pack.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="form-control">
                <span className="label-text text-sm font-medium text-base-content/70">Practice goal</span>
                <input
                  className="input input-bordered mt-2 w-full bg-base-100/55"
                  value={userGoal}
                  onChange={(event) => onUserGoalChange(event.target.value)}
                  placeholder={getPracticeGoalPlaceholder(selectedTemplateId)}
                  data-e2e="writing-goal-input"
                />
              </label>
            </div>
          </details>
          {starterPromptError ? (
            <div className="flex flex-wrap items-center gap-3 py-1 text-sm leading-6 text-error">
              <span className="selectable-content">{starterPromptError}</span>
              <button
                type="button"
                className="btn btn-outline btn-error btn-xs rounded-lg"
                onClick={onGenerateStarterPrompt}
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="ui-chrome flex flex-col gap-1 pb-2 text-xs text-base-content/38 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <details className="group relative text-base-content/45">
            <summary className="flex cursor-pointer list-none items-center gap-2 transition hover:text-base-content/70 [&::-webkit-details-marker]:hidden">
              <span>{template.title}</span>
              <span className="text-primary/70 group-open:hidden">Change</span>
              <span className="hidden text-primary/70 group-open:inline">Close</span>
            </summary>
            <div className="absolute left-0 z-20 mt-2 grid min-w-36 gap-2 rounded-xl bg-base-100 p-3 shadow-[0_12px_26px_rgba(72,60,42,0.08)]">
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
          <span aria-hidden="true" className="text-base-content/22">
            ·
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

      <CetPracticeGuidance templateId={selectedTemplateId} />

      <textarea
        className="writing-practice-surface paper-sheet mt-4 min-h-[38rem] flex-1 resize-none p-10 text-base-content outline-none transition placeholder:text-base-content/35 focus:border-primary/35 lg:min-h-0"
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="Start drafting in English. The coach waits until you ask for feedback."
        aria-label={`${template.title} writing practice editor`}
        data-e2e="writing-editor"
        spellCheck={false}
      />
      <p className="ui-chrome mt-3 py-1 text-right text-xs text-base-content/35">
        Feedback is available when your draft is ready.
      </p>
    </section>
  );
}

function getPracticeGoalPlaceholder(templateId: WritingEditorCardProps['selectedTemplateId']): string {
  switch (templateId) {
    case 'journal':
      return 'e.g. describe a memory, a decision, or a moment from today';
    case 'cet4':
      return 'e.g. choose an everyday topic, state a clear position, or practice one useful sentence pattern';
    case 'cet6':
      return 'e.g. set an argument topic, clarify your reasoning, or practice one precise expression';
    case 'free':
      return 'e.g. shape your own topic, clarify an idea, or practice a phrase';
  }
}
