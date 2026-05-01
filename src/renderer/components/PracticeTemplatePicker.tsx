import type { PracticeTemplatePickerProps } from './types';

export function PracticeTemplatePicker({
  templates,
  selectedTemplateId,
  onSelectTemplate,
}: PracticeTemplatePickerProps): React.JSX.Element {
  return (
    <section className="border-b border-base-300/60 pb-2 pt-3" aria-labelledby="practice-template-title">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Practice scenarios</p>
          <h2 id="practice-template-title" className="text-2xl font-semibold tracking-[-0.03em]">
            Choose another writing space
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-base-content/55">
          Journal, CET, and free writing stay equal as calm writing-practice scenarios.
        </p>
      </div>
      <div className="divide-y divide-base-300/55">
        {templates.map((template) => {
          const isSelected = template.id === selectedTemplateId;
          return (
            <button
              key={template.id}
              type="button"
              className={`grid w-full gap-2 py-4 text-left transition sm:grid-cols-[12rem_1fr] ${
                isSelected ? 'text-primary' : 'text-base-content/70 hover:text-base-content'
              }`}
              aria-pressed={isSelected}
              onClick={() => onSelectTemplate(template.id)}
            >
              <span className="font-semibold">{template.title}</span>
              <span className="text-sm leading-6 text-base-content/55">{template.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
