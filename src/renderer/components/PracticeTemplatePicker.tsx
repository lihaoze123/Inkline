import type { PracticeTemplatePickerProps } from './types';

export function PracticeTemplatePicker({
  templates,
  selectedTemplateId,
  onSelectTemplate,
}: PracticeTemplatePickerProps): React.JSX.Element {
  return (
    <section
      className="rounded-[2rem] border border-base-300/80 bg-base-100/85 p-4 shadow-xl shadow-primary/5"
      aria-labelledby="practice-template-title"
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Practice templates</p>
          <h2 id="practice-template-title" className="text-xl font-semibold tracking-[-0.03em]">
            Choose what to practice
          </h2>
        </div>
        <p className="text-sm text-base-content/55">Journal, CET, and free writing are equal practice scenarios.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {templates.map((template) => {
          const isSelected = template.id === selectedTemplateId;
          return (
            <button
              key={template.id}
              type="button"
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${isSelected ? 'border-primary bg-primary/10 shadow-md' : 'border-base-300 bg-base-200/45'}`}
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
