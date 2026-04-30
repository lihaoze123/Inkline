import type { PracticeHeaderProps } from './types';

export function PracticeHeader({ selectedTemplateTitle, startup, status }: PracticeHeaderProps): React.JSX.Element {
  return (
    <header className="flex flex-col gap-4 border-b border-base-300/60 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Write</span>
          <span className="badge badge-ghost badge-sm">{selectedTemplateTitle}</span>
          <span className={`badge badge-sm ${status.toneClassName}`}>{status.label}</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-base-content md:text-4xl">
          Writing Practice
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/60">
          Draft independently, then work with Coach feedback and follow-up rewrite practice.
        </p>
      </div>
      <div className="max-w-xs text-sm text-base-content/60 md:text-right">
        <p className="font-medium text-base-content/75">{status.detail}</p>
        <p className="mt-1 text-xs text-base-content/45">
          {startup.databaseReady ? 'Local database ready' : 'Local database unavailable'}
        </p>
      </div>
    </header>
  );
}
