import type { AutosaveStatusProps } from './types';
import { formatTime } from './format';

export function AutosaveStatus({ state, lastAutosaveAt, error }: AutosaveStatusProps): React.JSX.Element {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-info">
        <span className="loading loading-spinner loading-xs" />
        Saving...
      </span>
    );
  }

  if (state === 'error') {
    return <span className="text-sm text-error">{error ?? 'Could not save'}</span>;
  }

  if (lastAutosaveAt) {
    return <span className="text-sm text-success">Saved {formatTime(lastAutosaveAt)}</span>;
  }

  return <span className="text-sm text-base-content/45">Draft not saved yet</span>;
}
