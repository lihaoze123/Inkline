import type { PracticeHeaderProps } from './types';

export function PracticeHeader({ practicePromptTitle }: PracticeHeaderProps): React.JSX.Element {
  return (
    <header className="practice-page__header pb-2" aria-label="Writing workspace context">
      <h1 className="practice-page__title editorial-heading max-w-5xl text-3xl leading-[1.15] text-base-content md:text-[2.65rem]">
        {practicePromptTitle}
      </h1>
    </header>
  );
}
