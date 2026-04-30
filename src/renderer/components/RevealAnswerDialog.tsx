import type { RevealAnswerDialogProps } from './types';

export function RevealAnswerDialog({ isOpen, onCancel, onReveal }: RevealAnswerDialogProps): React.JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal modal-open" role="presentation">
      <section
        className="modal-box max-w-md rounded-[1.75rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reveal-answer-title"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Try first?</p>
        <h2 id="reveal-answer-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          Reveal model answer now?
        </h2>
        <p className="mt-3 leading-7 text-base-content/65">
          You can reveal it now, but self-repair works better when you try one sentence first.
        </p>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost rounded-2xl" onClick={onCancel}>
            Keep trying
          </button>
          <button type="button" className="btn btn-primary rounded-2xl" onClick={onReveal}>
            Reveal anyway
          </button>
        </div>
      </section>
      <button type="button" className="modal-backdrop" aria-label="Close reveal confirmation" onClick={onCancel}>
        close
      </button>
    </div>
  );
}
