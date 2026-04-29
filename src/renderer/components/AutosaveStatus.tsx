import type { AutosaveStatusProps } from './types';
import { formatTime } from './format';

export function AutosaveStatus({ state, lastAutosaveAt, error }: AutosaveStatusProps): React.JSX.Element {
  if (state === 'saving') {
    return <span className="badge badge-info badge-soft gap-2"><span className="loading loading-spinner loading-xs" />Autosaving</span>;
  }

  if (state === 'error') {
    return <span className="badge badge-error badge-soft">{error ?? 'Autosave failed'}</span>;
  }

  if (lastAutosaveAt) {
    return <span className="badge badge-success badge-soft">Saved {formatTime(lastAutosaveAt)}</span>;
  }

  return <span className="badge badge-ghost">Not saved yet</span>;
}
