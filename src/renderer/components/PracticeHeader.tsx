import type { PracticeHeaderProps } from './types';

export function PracticeHeader({
  selectedTemplateTitle,
  startup,
  status,
  onOpenSettings,
}: PracticeHeaderProps): React.JSX.Element {
  return (
    <header className="flex flex-col gap-5 rounded-[2rem] border border-base-300/80 bg-base-100/80 p-5 shadow-xl shadow-primary/5 backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-primary badge-soft">Practice</span>
          <span className="badge badge-ghost">{selectedTemplateTitle}</span>
          <span className={`badge ${status.toneClassName}`}>{status.label}</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-base-content md:text-5xl">Writing Practice</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/60 md:text-base">
            Practice writing with focused AI feedback and next-day rewrite drills.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        <div className="rounded-2xl border border-base-300 bg-base-200/60 px-4 py-3 text-sm text-base-content/70">
          <p className="font-medium text-base-content">{status.detail}</p>
          <p className="mt-1 text-xs text-base-content/50">
            {startup.databaseReady ? 'Local database ready' : 'Local database unavailable'}
          </p>
        </div>
        <button type="button" className="btn btn-neutral rounded-2xl" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </header>
  );
}
