import type { PracticeHeaderProps } from './types';

export function PracticeHeader({
  practicePromptTitle,
  selectedTemplateTitle,
  instruction,
  startup,
  status,
}: PracticeHeaderProps): React.JSX.Element {
  return (
    <header className="relative overflow-hidden border-b border-base-300/60 pb-7" aria-label="Writing workspace context">
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-base-content/55">
            <span>Practice</span>
            <span aria-hidden="true">›</span>
            <span className="text-base-content/70">Writing Workspace</span>
          </div>
          <h1 className="editorial-heading mt-5 max-w-5xl text-5xl leading-[1.05] text-base-content">
            {practicePromptTitle}
          </h1>
          <p className="mt-5 text-sm text-base-content/52">
            {selectedTemplateTitle} · {status.label}
          </p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-base-content/58">{instruction}</p>
          <p className="mt-2 text-xs text-base-content/42">
            {startup.databaseReady ? 'Local database ready' : 'Local database unavailable'} · {status.detail}
          </p>
        </div>
        <div className="illustration-placeholder hidden shrink-0 lg:block" aria-hidden="true" />
      </div>
    </header>
  );
}
