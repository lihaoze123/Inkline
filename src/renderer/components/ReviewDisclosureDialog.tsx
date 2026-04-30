import type { ReviewDisclosureDialogProps } from './types';

export function ReviewDisclosureDialog({
  settings,
  mode = 'review',
  onCancel,
  onAcknowledge,
}: ReviewDisclosureDialogProps): React.JSX.Element {
  const isStarter = mode === 'starter';
  return (
    <div className="modal modal-open" role="presentation">
      <section
        className="modal-box max-w-2xl rounded-[1.75rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-disclosure-title"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
          {isStarter ? 'Before first prompt generation' : 'Before first review'}
        </p>
        <h2 id="review-disclosure-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          Provider privacy disclosure
        </h2>
        <div className="mt-4 space-y-3 leading-7 text-base-content/65">
          <p>Your writing stays local by default.</p>
          <p>
            {isStarter
              ? 'When you generate a starter prompt/topic, the selected template and optional goal/topic are sent to your configured model provider. No user essay content is sent for this generation step.'
              : 'When you click Review, the current writing attempt, selected template context, and selected learning history will be sent to your configured model provider.'}
          </p>
        </div>
        <dl className="mt-6 grid gap-3 rounded-2xl border border-base-300 bg-base-200/55 p-4 text-sm">
          <DisclosureRow label="Provider" value={settings.provider} />
          <DisclosureRow label="Model" value={settings.model} />
          <DisclosureRow label="Local model" value={settings.isLocalModel ? 'Yes' : 'No'} />
          <DisclosureRow label="Review context" value={settings.reviewContextDescription} />
          <DisclosureRow label="Raw model responses saved" value={settings.rawResponseStorageEnabled ? 'Yes' : 'No'} />
        </dl>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost rounded-2xl" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary rounded-2xl" onClick={onAcknowledge}>
            {isStarter ? 'I understand, generate prompt' : 'I understand, review now'}
          </button>
        </div>
      </section>
    </div>
  );
}

function DisclosureRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="grid gap-1 border-t border-base-300 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/40">{label}</dt>
      <dd className="m-0 break-words text-base-content/75">{value}</dd>
    </div>
  );
}
