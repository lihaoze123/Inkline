import type { PracticeTemplatePickerProps } from './types';

export function PracticeTemplatePicker({
  templates,
  selectedTemplateId,
  onSelectTemplate,
}: PracticeTemplatePickerProps): React.JSX.Element {
  return (
    <section className="border-b border-base-300/60 pb-6" aria-labelledby="practice-template-title">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Practice templates</p>
          <h2 id="practice-template-title" className="text-xl font-semibold tracking-[-0.03em]">
            Choose what to practice
          </h2>
        </div>
        <p className="text-sm text-base-content/55">Journal, CET, and free writing are equal practice scenarios.</p>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {templates.map((template) => {
          const isSelected = template.id === selectedTemplateId;
          return (
            <button
              key={template.id}
              type="button"
              className={`rounded-xl border px-4 py-3 text-left transition hover:border-primary/50 hover:bg-primary/5 ${isSelected ? 'border-primary/60 bg-primary/10' : 'border-base-300/70 bg-transparent'}`}
              aria-pressed={isSelected}
              onClick={() => onSelectTemplate(template.id)}
            >
              <span className="font-semibold">{template.title}</span>
              <span className="mt-2 block text-sm leading-6 text-base-content/60">{template.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
