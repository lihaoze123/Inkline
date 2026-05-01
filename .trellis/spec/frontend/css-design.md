# CSS & Design System

> CSS modularization and design tokens.

---

## CSS Organization

### Entry Point

`src/renderer/src/styles/index.css` is the single CSS entrypoint imported by the renderer bootstrap.

**Folder structure**:

```
src/renderer/src/styles/
├── index.css            # Entry point (imports in a stable order)
├── tokens.css           # :root tokens + .dark overrides
├── base.css             # html/body/typography/focus/scrollbars
├── components/          # Component-scoped classes
│   ├── sidebar.css
│   ├── tabbar.css
│   └── ...
├── layout/              # Shell-level layout helpers
└── pages/               # Page-specific styling
```

**Rules**:

- Keep `index.css` import order stable to avoid cascade regressions
- When adding new styles, put them in the closest domain file (components/layout/pages)
- If a file grows beyond ~300-500 lines, split it

### Index.css Structure

```css
/* src/renderer/src/styles/index.css */

/* 1. Design tokens first */
@import './tokens.css';

/* 2. Base styles (reset, typography) */
@import './base.css';

/* 3. Layout helpers */
@import './layout/shell.css';

/* 4. Component styles */
@import './components/sidebar.css';
@import './components/tabbar.css';
@import './components/dialog.css';

/* 5. Page-specific styles */
@import './pages/home.css';
@import './pages/settings.css';
```

---

## Design Tokens

### CSS Custom Properties

Define design tokens as CSS custom properties in `:root`:

```css
/* src/renderer/src/styles/tokens.css */
:root {
  /* Colors */
  --color-background: 0 0% 100%; /* HSL format for Tailwind */
  --color-foreground: 20 14% 4%;
  --color-primary: 24 10% 10%;
  --color-primary-foreground: 60 9% 98%;
  --color-muted: 60 5% 96%;
  --color-muted-foreground: 25 5% 45%;
  --color-border: 20 6% 90%;
  --color-destructive: 0 84% 60%;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

  /* Typography */
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, monospace;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}

/* Dark mode overrides */
.dark {
  --color-background: 20 14% 4%;
  --color-foreground: 60 9% 98%;
  --color-primary: 60 9% 98%;
  --color-primary-foreground: 24 10% 10%;
  --color-muted: 12 6% 15%;
  --color-muted-foreground: 24 5% 64%;
  --color-border: 12 6% 15%;
}
```

### Using Tokens with Tailwind

```css
/* tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--color-background))",
        foreground: "hsl(var(--color-foreground))",
        primary: {
          DEFAULT: "hsl(var(--color-primary))",
          foreground: "hsl(var(--color-primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--color-muted))",
          foreground: "hsl(var(--color-muted-foreground))",
        },
        border: "hsl(var(--color-border))",
        destructive: "hsl(var(--color-destructive))",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
    },
  },
};
```

---

## CSS Class Naming Convention (BEM)

Use **BEM naming convention** to prevent class name conflicts:

### BEM Structure

```
.block                    /* Independent component */
.block__element           /* Internal element */
.block__element--modifier /* Element variant */
```

### Naming Rules

| Type               | Format              | Example                           |
| ------------------ | ------------------- | --------------------------------- |
| Block (container)  | `component-name`    | `.sidebar-dropdown`               |
| Element (child)    | `block__element`    | `.sidebar-dropdown__menu`         |
| Modifier (variant) | `element--modifier` | `.sidebar-dropdown__item--danger` |

### Example

```css
/* Good: BEM clearly distinguishes elements */
.sidebar-dropdown {
} /* Block: entire dropdown component */
.sidebar-dropdown__menu {
} /* Element: menu container */
.sidebar-dropdown__item {
} /* Element: menu item */
.sidebar-dropdown__item--danger {
} /* Modifier: danger variant */

/* Bad: easy to confuse */
.sidebar-dropdown-menu {
} /* Is this a container or a menu item? */
.sidebar-dropdown-item {
}
.sidebar-dropdown-item--danger {
}
```

### Guidelines

1. **Block naming**: Use kebab-case, describe component function (e.g., `entity-menu`, `doc-tree`)
2. **Element naming**: Double underscore `__`, describe child role (e.g., `__header`, `__item`, `__icon`)
3. **Modifier naming**: Double hyphen `--`, describe state or variant (e.g., `--active`, `--disabled`, `--danger`)
4. **Avoid deep nesting**: Maximum one level of element, don't write `.block__element__subelement`

### When to Use BEM vs Tailwind

| Scenario                          | Recommended              |
| --------------------------------- | ------------------------ |
| Simple components, one-off styles | Tailwind utility classes |
| Complex components, reusable      | BEM + CSS file           |
| Dynamic state toggling in JS      | BEM modifier classes     |
| Component library (shadcn/ui)     | Use built-in variants    |

---

## Inkline Visual Contract

### Convention: Minimal Editorial Writing Workspace

**What**: Inkline UI must use a minimal, elegant, warm editorial writing-workspace style. The default composition is flat: whitespace, typography, and thin dividers carry structure. Card-like surfaces are reserved for true writing paper/editor surfaces or blocking system states.

**Why**: The product should feel like a serious writing-practice desk, not a generic dashboard or bubbly AI app. Extra cards, badges, metrics, and mismatched sidebar panels make the interface noisy and weaken the less-is-more writing focus.

### Visual Contracts

| Area | Required contract |
| ---- | ----------------- |
| App background | Use one coordinated warm paper background across shell and sidebar. |
| Sidebar | Do not make the sidebar look like an independent color block; use the same warm paper token plus a very subtle divider. |
| Active navigation | Prefer text weight/color only; do not use left rails, colored bars, or large active pills. |
| Page sections | Prefer natural whitespace, typography, and aligned rhythm over repeated horizontal rules; use borders sparingly only for major boundaries or meaningful warning/error/state accents. |
| Page entry surfaces | Keep Today/Home launch surfaces to one focused hero; move secondary context behind subtle text links or the destination page. |
| Settings forms | Use quiet editorial form rows: short label column, constrained control column, helper text under the control, and stacked rows on small screens. |
| Practice workspace | Keep the prompt bar minimal and the editor dominant; scenario switching, starter/goal controls, autosave, word count, and coach status should read as weak secondary UI before review. |
| Practice template chrome | Show the selected template once in weak editor chrome before `Draft`, e.g. `Journal Change | Draft`; do not duplicate the template label above the prompt title and again above the editor. |
| Reviewing progress | Render review progress as an inline side-panel state, not nested disclosures, cards, or alerts. Display duration only on the active step row. |
| Writing editor | The paper textarea/editor may use a sheet surface because it represents the writing medium. |
| Primary actions | Use at most one deep sea-blue primary CTA per page; secondary navigation, settings, and configuration actions should be outline or text actions. |
| Reference art | Keep botanical/landscape art as a placeholder only until final assets are supplied. |
| Global ink art | Keep the right-top ink landscape treatment visually consistent across app pages; avoid page-specific artwork size or position variants. Dense pages should move content away from the shared art instead of shrinking or hiding the art. |
| Concept-image metadata | Do not add unplanned badges, fake timers, difficulty labels, focus chips, or honor/status labels from reference images. |

### Examples

```tsx
// Correct: flat section hierarchy with dividers and warm coordinated sidebar
<main className="app-chrome min-h-screen text-base-content">
  <div className="grid h-screen grid-cols-[19.5rem_minmax(0,1fr)]">
    <nav className="quiet-sidebar border-r border-base-300/45 px-9 py-10">
      <button className={isActive ? 'font-semibold text-primary' : 'text-base-content/62'}>
        Practice
      </button>
    </nav>
    <section className="border-y border-base-300/60 py-8">
      <h1 className="editorial-heading">Describe one small decision you made today.</h1>
    </section>
  </div>
</main>
```

```tsx
// Wrong: noisy dashboard/card visual language for core writing flow
<section className="rounded-xl border bg-base-100 p-6 shadow-xl">
  <span className="badge">10 min</span>
  <span className="badge">Beginner+</span>
  <span className="badge">Focus</span>
  <h1>Describe one small decision you made today.</h1>
</section>
```

```tsx
// Correct: the editor itself can remain paper-like because it is the writing medium
<textarea className="writing-practice-surface paper-sheet min-h-[34rem] resize-none p-10" />
```

### Validation Checks

- Search for `quiet-card`, heavy `shadow-*`, and repeated `rounded-xl border bg-*` before finishing a writing-flow UI pass.
- Confirm sidebar background visually coordinates with the main page background; it should not read as pink/gray/blue side panel against warm paper.
- Confirm reference images are used for mood only, not as a source of new product metadata.
- Run `pnpm typecheck && pnpm lint` after UI refactors.
- For frontend UI changes, smoke-test the golden path in the Electron app before calling the work complete when runtime access is available.

---

## Portal Components

Components using `createPortal` to render to `document.body` need special handling:

```css
.sidebar-dropdown__menu--portal {
  position: fixed;
  z-index: 9999;
}
```

---

## Base Styles

### Typography

```css
/* src/renderer/src/styles/base.css */
html {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

body {
  background-color: hsl(var(--color-background));
  color: hsl(var(--color-foreground));
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-weight: 600;
  line-height: 1.25;
}

h1 {
  font-size: 2rem;
}
h2 {
  font-size: 1.5rem;
}
h3 {
  font-size: 1.25rem;
}
h4 {
  font-size: 1rem;
}
```

### Focus States

```css
/* Consistent focus ring */
:focus-visible {
  outline: 2px solid hsl(var(--color-primary));
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Scrollbars (Notion-style)

```css
/* Hide scrollbars by default, show on hover */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--color-foreground) / 0);
  border-radius: 5px;
  transition: background 0.4s ease;
}

/* Show on container hover */
.scrollable:hover::-webkit-scrollbar-thumb {
  background: hsl(var(--color-foreground) / 0.12);
  transition: background 0.15s ease;
}

/* Darker on scrollbar hover */
.scrollable::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--color-foreground) / 0.22);
}

/* Even darker when dragging */
.scrollable::-webkit-scrollbar-thumb:active {
  background: hsl(var(--color-foreground) / 0.32);
}
```

---

## Component Styles Example

```css
/* src/renderer/src/styles/components/sidebar.css */

/* Block */
.sidebar {
  width: var(--sidebar-width, 240px);
  height: 100%;
  background: hsl(var(--color-background));
  border-right: 1px solid hsl(var(--color-border));
  display: flex;
  flex-direction: column;
}

/* Elements */
.sidebar__header {
  padding: var(--spacing-md);
  border-bottom: 1px solid hsl(var(--color-border));
}

.sidebar__content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

.sidebar__footer {
  padding: var(--spacing-md);
  border-top: 1px solid hsl(var(--color-border));
}

/* Item element */
.sidebar__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

/* Modifiers */
.sidebar__item:hover {
  background: hsl(var(--color-muted));
}

.sidebar__item--active {
  background: hsl(var(--color-muted));
  font-weight: 500;
}

.sidebar__item--disabled {
  opacity: 0.5;
  pointer-events: none;
}
```

---

## Quick Reference

| Question                       | Answer                                    |
| ------------------------------ | ----------------------------------------- |
| Where to define colors?        | `tokens.css` as CSS custom properties     |
| Where to put component styles? | `styles/components/{name}.css`            |
| How to name CSS classes?       | BEM: `.block__element--modifier`          |
| When to use Tailwind vs BEM?   | Simple = Tailwind, Complex/Reusable = BEM |
| How to support dark mode?      | Override tokens in `.dark` class          |

---

**Language**: All documentation must be written in **English**.
