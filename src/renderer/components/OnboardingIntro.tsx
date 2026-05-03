import { useEffect, useRef, useState } from 'react';
import appIconUrl from '../assets/app-icon.png';

const BRAND_HOLD_MS = 4500;
const SLIDE_AUTO_ADVANCE_MS = 5600;

type IntroStage = 'brand' | 'slides';

type OnboardingSlide = {
  id: string;
  title: string;
  body: string;
  visualLabel: string;
  panel: 'entry' | 'draft' | 'review';
};

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'entry',
    title: 'Start with one quiet prompt',
    body: 'Today gives you a calm entry into writing practice without a busy dashboard.',
    visualLabel: 'Entry concept illustration',
    panel: 'entry',
  },
  {
    id: 'draft',
    title: 'Write first, no interruptions',
    body: 'Draft independently before the coach adds any correction or suggestion.',
    visualLabel: 'Draft concept illustration',
    panel: 'draft',
  },
  {
    id: 'review',
    title: 'Review one pattern, then rewrite',
    body: 'Feedback narrows to one transferable pattern and brings you back to a small rewrite.',
    visualLabel: 'Review concept illustration',
    panel: 'review',
  },
];

export type OnboardingIntroProps = {
  isDismissPending: boolean;
  error: string | null;
  onDismiss: () => Promise<void>;
};

export function OnboardingIntro({ isDismissPending, error, onDismiss }: OnboardingIntroProps): React.JSX.Element {
  const prefersReducedMotion = usePrefersReducedMotion();
  const dialogRef = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<IntroStage>('brand');
  const [slideIndex, setSlideIndex] = useState(0);
  const [hasManualControl, setHasManualControl] = useState(false);
  const slide = ONBOARDING_SLIDES[slideIndex];
  const isFirstSlide = slideIndex === 0;
  const isFinalSlide = slideIndex === ONBOARDING_SLIDES.length - 1;

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || isDismissPending) {
        return;
      }

      event.preventDefault();
      void onDismiss();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDismissPending, onDismiss]);

  useEffect(() => {
    if (prefersReducedMotion || stage !== 'brand') {
      return;
    }

    const timeoutId = window.setTimeout(() => setStage('slides'), BRAND_HOLD_MS);
    return () => window.clearTimeout(timeoutId);
  }, [prefersReducedMotion, stage]);

  useEffect(() => {
    if (prefersReducedMotion || hasManualControl || stage !== 'slides' || isFinalSlide || isDismissPending) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSlideIndex((current) => Math.min(current + 1, ONBOARDING_SLIDES.length - 1));
    }, SLIDE_AUTO_ADVANCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [hasManualControl, isDismissPending, isFinalSlide, prefersReducedMotion, stage, slideIndex]);

  const dismissIntro = (): void => {
    if (isDismissPending) {
      return;
    }

    void onDismiss();
  };

  const showPreviousSlide = (): void => {
    setHasManualControl(true);
    setSlideIndex((current) => Math.max(current - 1, 0));
  };

  const showNextSlide = (): void => {
    setHasManualControl(true);
    setSlideIndex((current) => Math.min(current + 1, ONBOARDING_SLIDES.length - 1));
  };

  const showSlide = (nextSlideIndex: number): void => {
    setHasManualControl(true);
    setSlideIndex(nextSlideIndex);
  };

  return (
    <section
      ref={dialogRef}
      className="welcome-intro fixed inset-0 z-50 flex min-h-screen flex-col bg-base-200 text-base-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby={stage === 'brand' ? 'welcome-intro-brand-title' : 'welcome-intro-slide-title'}
      aria-describedby={stage === 'brand' ? 'welcome-intro-brand-description' : 'welcome-intro-slide-description'}
      tabIndex={-1}
    >
      <div className="welcome-intro__drag-strip" aria-hidden="true" />

      {stage === 'brand' ? (
        <div className="welcome-intro__brand flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
          <div className="welcome-intro__brand-mark grid size-20 place-items-center">
            <img className="welcome-intro__brand-icon" src={appIconUrl} alt="" aria-hidden="true" />
          </div>
          <h1
            id="welcome-intro-brand-title"
            className="editorial-heading mt-7 text-5xl leading-none text-base-content md:text-6xl"
          >
            Inkline
          </h1>
          <p id="welcome-intro-brand-description" className="mt-4 max-w-md text-base leading-7 text-base-content/58">
            A quiet desk for focused English writing practice.
          </p>
          {prefersReducedMotion ? (
            <button
              type="button"
              className="btn btn-outline mt-9 rounded-[0.7rem] px-8"
              onClick={() => setStage('slides')}
            >
              Continue
            </button>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="welcome-intro__slide flex min-h-0 flex-1 flex-col px-6 pb-7 md:px-9">
          <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(19rem,0.72fr)]">
            <IntroVisual slide={slide} />
            <div className="max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
                {String(slideIndex + 1).padStart(2, '0')} / {String(ONBOARDING_SLIDES.length).padStart(2, '0')}
              </p>
              <h2 id="welcome-intro-slide-title" className="editorial-heading mt-5 text-5xl leading-[1.04]">
                {slide.title}
              </h2>
              <p id="welcome-intro-slide-description" className="mt-5 text-base leading-7 text-base-content/62">
                {slide.body}
              </p>

              <div className="mt-8 flex items-center gap-2" aria-label="Welcome intro slides">
                {ONBOARDING_SLIDES.map((introSlide, index) => (
                  <button
                    key={introSlide.id}
                    type="button"
                    className={`h-1.5 rounded-full transition-all ${
                      index === slideIndex ? 'w-9 bg-primary' : 'w-5 bg-base-content/18 hover:bg-base-content/32'
                    }`}
                    aria-label={`Show slide ${index + 1}`}
                    aria-current={index === slideIndex ? 'step' : undefined}
                    onClick={() => showSlide(index)}
                  />
                ))}
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn btn-outline rounded-[0.7rem] px-7"
                  disabled={isFirstSlide || isDismissPending}
                  onClick={showPreviousSlide}
                >
                  Back
                </button>
                {isFinalSlide ? (
                  <button
                    type="button"
                    className="btn btn-primary rounded-[0.7rem] px-8 shadow-[0_12px_24px_rgba(22,71,101,0.16)]"
                    disabled={isDismissPending}
                    onClick={dismissIntro}
                  >
                    {isDismissPending ? 'Entering...' : 'Enter Inkline'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline rounded-[0.7rem] px-7"
                    disabled={isDismissPending}
                    onClick={showNextSlide}
                  >
                    Next
                  </button>
                )}
              </div>

              {error ? (
                <p className="mt-4 text-sm text-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function IntroVisual({ slide }: { slide: OnboardingSlide }): React.JSX.Element {
  return (
    <figure
      className="welcome-intro__visual paper-sheet mx-auto grid w-full max-w-3xl overflow-hidden p-4 md:p-5"
      aria-label={slide.visualLabel}
    >
      <div className="welcome-intro__visual-accent" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      {slide.panel === 'entry' ? <EntryPanel /> : null}
      {slide.panel === 'draft' ? <DraftPanel /> : null}
      {slide.panel === 'review' ? <ReviewPanel /> : null}
    </figure>
  );
}

function EntryPanel(): React.JSX.Element {
  return (
    <div className="grid min-h-[26rem] gap-6 p-5 md:grid-cols-[11rem_minmax(0,1fr)] md:p-7">
      <div className="hidden border-r border-base-300/50 pr-5 md:block">
        <p className="editorial-copy text-2xl text-base-content/72">Inkline</p>
        <div className="mt-8 grid gap-4 text-sm text-base-content/40">
          <span className="font-semibold text-primary">Today</span>
          <span>Practice</span>
          <span>Notebook</span>
        </div>
      </div>
      <div className="content-center">
        <p className="text-sm text-base-content/45">Good morning.</p>
        <p className="editorial-heading mt-5 max-w-lg text-4xl leading-[1.08] text-base-content">
          Describe one small decision you made today.
        </p>
        <div className="mt-8 h-10 w-36 rounded-[0.65rem] bg-primary/90" />
      </div>
    </div>
  );
}

function DraftPanel(): React.JSX.Element {
  return (
    <div className="grid min-h-[26rem] gap-5 p-5 md:grid-cols-[minmax(0,1fr)_10rem] md:p-7">
      <div className="flex flex-col">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">Practice</p>
        <p className="editorial-heading mt-4 text-3xl leading-tight text-base-content">
          Write about one idea you want to express clearly.
        </p>
        <div className="mt-5 flex items-center gap-3 text-xs text-base-content/40">
          <span>Free Writing</span>
          <span aria-hidden="true">|</span>
          <span>Draft</span>
        </div>
        <div className="mt-4 flex-1 border border-base-300/70 bg-base-100 p-5">
          <div className="grid gap-3">
            <span className="h-2 w-11/12 rounded-full bg-base-content/12" />
            <span className="h-2 w-10/12 rounded-full bg-base-content/10" />
            <span className="h-2 w-8/12 rounded-full bg-base-content/10" />
            <span className="mt-4 h-2 w-9/12 rounded-full bg-base-content/10" />
            <span className="h-2 w-7/12 rounded-full bg-base-content/10" />
          </div>
        </div>
      </div>
      <div className="hidden border-l border-base-300/50 pl-5 text-sm text-base-content/42 md:block">
        <p className="font-medium text-base-content/55">Coach</p>
        <p className="mt-4 leading-6">Available after your draft.</p>
      </div>
    </div>
  );
}

function ReviewPanel(): React.JSX.Element {
  return (
    <div className="grid min-h-[26rem] gap-6 p-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:p-7">
      <div className="grid content-start gap-6">
        <div>
          <p className="editorial-copy text-2xl text-base-content/76">One focus pattern</p>
          <div className="mt-4 h-2 w-36 rounded-full bg-primary/70" />
          <div className="mt-5 grid gap-3">
            <span className="h-2 w-full rounded-full bg-base-content/10" />
            <span className="h-2 w-10/12 rounded-full bg-base-content/10" />
          </div>
        </div>
        <div>
          <p className="editorial-copy text-xl text-base-content/70">Original draft</p>
          <div className="mt-4 grid gap-3">
            <span className="h-2 w-11/12 rounded-full bg-base-content/10" />
            <span className="h-2 w-8/12 rounded-full bg-warning/45" />
            <span className="h-2 w-10/12 rounded-full bg-base-content/10" />
          </div>
        </div>
      </div>
      <div className="border border-base-300/70 bg-base-100 p-5">
        <p className="editorial-copy text-2xl text-base-content">Try rewriting</p>
        <p className="mt-3 text-sm text-base-content/46">Your rewrite</p>
        <div className="mt-5 grid gap-3">
          <span className="h-2 w-10/12 rounded-full bg-base-content/10" />
          <span className="h-2 w-8/12 rounded-full bg-base-content/10" />
          <span className="h-2 w-9/12 rounded-full bg-base-content/10" />
        </div>
      </div>
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = (): void => setPrefersReducedMotion(mediaQuery.matches);

    syncPreference();
    mediaQuery.addEventListener('change', syncPreference);
    return () => mediaQuery.removeEventListener('change', syncPreference);
  }, []);

  return prefersReducedMotion;
}
