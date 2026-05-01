import type { AutosaveStatusProps } from './types';
import { formatTime } from './format';

export function AutosaveStatus({ state, lastAutosaveAt, error }: AutosaveStatusProps): React.JSX.Element {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-base-content/45">
        <span className="loading loading-spinner loading-xs opacity-60" />
        Saving...
      </span>
    );
  }

  if (state === 'error') {
    return <span className="text-xs text-error/80">{error ?? 'Could not save'}</span>;
  }

  if (lastAutosaveAt) {
    return <span className="text-xs text-base-content/38">Saved {formatTime(lastAutosaveAt)}</span>;
  }

  return <span className="text-xs text-base-content/35">Draft not saved yet</span>;
}
