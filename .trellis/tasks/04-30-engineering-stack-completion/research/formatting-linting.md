# Research: Formatting and linting for ESLint v9 TypeScript React

- **Query**: Research formatting/linting best practices for a modern TypeScript + React project with ESLint v9 flat config. Compare Prettier, Biome, and ESLint-only approaches; include tradeoffs for minimal adoption and CI. Map recommendations to this repo.
- **Scope**: mixed
- **Date**: 2026-04-30

## Findings

### Files Found

| File Path | Description |
|---|---|
| `package.json` | Project scripts and direct tool dependencies. Current checks are `lint`, `typecheck`, `test`, `review:harness`, and Electron build/package scripts. |
| `eslint.config.js` | ESLint v9 flat config using `@eslint/js`, `@typescript-eslint`, and `eslint-plugin-react-hooks`. |
| `tsconfig.json` | Strict TypeScript project with React JSX, path aliases, and `eslint.config.js` included for type-aware linting. |
| `.trellis/spec/frontend/quality.md` | Frontend quality checklist requires `pnpm typecheck`, `pnpm lint`, manual testing, and 0 lint warnings. |
| `.trellis/spec/shared/code-quality.md` | Shared quality spec requires `npm run lint` and `npm run typecheck` before commit. |
| `.trellis/spec/product/validation-and-testing.md` | Product validation spec lists `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm review:harness`, and `pnpm dev`. |

No repo-level Prettier config (`.prettierrc*` or `prettier.config.*`) or Biome config (`biome.json*`) was found outside `node_modules`.

### Code Patterns

Current package scripts in `package.json:8-17`:

```json
"scripts": {
  "dev": "electron-forge start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "review:harness": "tsx scripts/review-contract-harness.ts",
  "build": "electron-forge package",
  "package": "electron-forge package",
  "make": "electron-forge make",
  "postinstall": "electron-rebuild"
}
```

Current direct lint-related dependencies in `package.json:46-52`:

```json
"@typescript-eslint/eslint-plugin": "^8.48.1",
"@typescript-eslint/parser": "^8.48.1",
"eslint": "^9.39.1",
"eslint-plugin-react-hooks": "^7.0.1"
```

Installed tool check showed:

- `pnpm exec eslint --version` -> `v9.39.4`
- `pnpm exec prettier --version` -> `3.8.3` available transitively, but not declared as a direct dependency in `package.json`.
- `pnpm exec biome --version` -> command not found.

Current ESLint flat config in `eslint.config.js:6-51`:

- Ignores generated/build outputs: `node_modules/**`, `.vite/**`, `src/renderer/.vite/**`, `out/**`, `dist/**`, `coverage/**`.
- Applies `js.configs.recommended` globally.
- Applies TypeScript parser and type-aware project config to `**/*.{ts,tsx}`.
- Uses `@typescript-eslint` recommended rules and React Hooks recommended rules.
- Project-specific strict rules:
  - `@typescript-eslint/consistent-type-imports`: error, prefer type imports.
  - `@typescript-eslint/no-explicit-any`: error.
  - `@typescript-eslint/no-non-null-assertion`: error.
  - `@typescript-eslint/explicit-function-return-type`: error, with expression/typed-function exceptions.

The TypeScript config is strict (`tsconfig.json:2-25`) and includes source, tests, scripts, Forge/Vite config, and `eslint.config.js`.

Quality specs require lint/typecheck as part of validation:

- `.trellis/spec/frontend/quality.md:27-46` requires `pnpm typecheck`, `pnpm lint`, manual testing, and 0 lint warnings before commit.
- `.trellis/spec/shared/code-quality.md:54-63` requires `npm run lint` and `npm run typecheck` before commit.
- `.trellis/spec/product/validation-and-testing.md:111-135` lists `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm review:harness`, and `pnpm dev`, and says automated checks must include lint, typecheck, and tests for changed behavior.

### External References

- [ESLint Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) — ESLint v9 uses `eslint.config.js` flat config by default; config objects can set `files`, `ignores`, `languageOptions`, `plugins`, and `rules`.
- [ESLint CLI Reference](https://eslint.org/docs/latest/use/command-line-interface) — `eslint .` is the standard project-wide lint command; `--fix` can apply autofixable lint changes; `--max-warnings 0` is commonly used in CI to fail on warnings.
- [typescript-eslint Getting Started](https://typescript-eslint.io/getting-started/) — for TypeScript linting, use `typescript-eslint` packages with ESLint flat config; type-aware linting depends on parser project configuration.
- [eslint-plugin-react-hooks README](https://www.npmjs.com/package/eslint-plugin-react-hooks) — React Hooks linting is the standard companion for React projects and supports flat config recommended presets.
- [Prettier Why Prettier](https://prettier.io/docs/why-prettier) — Prettier focuses on code formatting and intentionally reduces style debates by reprinting code from an AST.
- [Prettier Integrating with Linters](https://prettier.io/docs/integrating-with-linters) — Prettier recommends letting Prettier handle formatting and linters handle code-quality rules; formatting rules in linters can conflict and should be disabled when using Prettier.
- [prettier-eslint-config / eslint-config-prettier](https://github.com/prettier/eslint-config-prettier) — disables ESLint rules that conflict with Prettier formatting; relevant if style rules are later added to ESLint.
- [Biome Formatter](https://biomejs.dev/formatter/) — Biome provides a fast formatter with broad language support and formatting options similar in scope to Prettier.
- [Biome Linter](https://biomejs.dev/linter/) — Biome includes linting rules and can lint/format with one tool, but rule parity with mature ESLint plugin ecosystems should be checked per project.
- [Biome Migrate ESLint and Prettier](https://biomejs.dev/guides/migrate-eslint-prettier/) — Biome has migration commands for existing ESLint/Prettier configurations, useful when replacing or consolidating tools.
- [Vite React](https://vite.dev/guide/) — Vite React projects commonly pair TypeScript, ESLint, and a separate formatter; this repo uses Vite through Electron Forge.

### Approach Comparison

| Approach | What it covers | Strengths | Tradeoffs | Minimal adoption shape | CI shape |
|---|---|---|---|---|---|
| Prettier + ESLint | Prettier formats; ESLint catches correctness, maintainability, React Hooks, TypeScript rules. | Most common separation of concerns; small conceptual surface; strong editor support; works well with ESLint v9 flat config; low migration risk because it does not replace existing ESLint rules. | Adds another direct dev dependency and format config/script; style diffs may be large on first run; requires deciding whether CI checks formatting. | Add direct `prettier`, optional `.prettierrc`/ignore, `format` and/or `format:check`; keep current ESLint config focused on quality. | Run `pnpm lint`, `pnpm typecheck`, and optionally `pnpm format:check`; use `--max-warnings 0` if CI must enforce 0 warnings. |
| Biome + ESLint | Biome formats and can lint some code patterns; ESLint remains for TypeScript type-aware/project-specific and React Hooks rules, or Biome replaces more over time. | Very fast; one binary can handle format/check; good for large repos and fast CI; can consolidate formatter and some simple linting. | Not currently installed; replacing ESLint would risk losing plugin-specific coverage (`@typescript-eslint`, React Hooks) unless parity is verified; two lint tools can create overlapping diagnostics if both used. | Add `@biomejs/biome` and `biome.json`; start with formatter-only or `biome check` for formatting/import organization while keeping ESLint. | Run `pnpm biome check .` plus current `pnpm lint`/`pnpm typecheck`, or use `biome ci` for formatting-only enforcement depending on config. |
| ESLint-only | ESLint handles code-quality rules and any stylistic formatting rules configured through ESLint plugins. | Fewest tools; current repo already has ESLint v9 flat config and `pnpm lint`; no formatter migration. | ESLint core has moved away from formatting-style rules; formatter behavior is less comprehensive than Prettier/Biome; can mix quality and formatting concerns; editor formatting may be less uniform. | Keep current setup; optionally add autofix script (`eslint . --fix`) and warning enforcement. | Run `pnpm lint` and `pnpm typecheck`; add `--max-warnings 0` if warnings become part of config. |

### Mapping to This Repo

Current state:

- The repo already has ESLint v9 flat config and strict TypeScript checks.
- The repo has no direct formatter dependency/config outside transitive Prettier in `node_modules`.
- Quality specs already name lint/typecheck/test commands and mostly use `pnpm`.
- The existing ESLint config has quality-oriented rules, not explicit style-formatting rules.
- There is no CI config found in the searched scope; CI guidance should map to existing scripts unless a CI workflow is introduced elsewhere.

Minimal-adoption mapping:

1. Lowest change / status quo: keep ESLint-only validation with `pnpm lint` and `pnpm typecheck`. This matches existing scripts and specs, but does not create deterministic formatting enforcement.
2. Small formatter addition: Prettier is the lowest-risk formatter addition because it can be added without replacing the current ESLint flat config. The repo would keep ESLint for type-aware rules and React Hooks, and add a separate format command/check.
3. Consolidated-tool direction: Biome is viable if speed and one-tool formatting/checking become a priority, but this repo's current value is in ESLint plugin rules. Minimal Biome adoption would be formatter-first while retaining ESLint.

CI mapping:

- Existing required checks from specs: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and for review-flow changes `pnpm review:harness`.
- If adding Prettier or Biome formatter enforcement, add a non-mutating CI check (`prettier --check .` or `biome check .`) rather than a write command.
- If keeping ESLint-only, CI can continue using `pnpm lint`; `--max-warnings 0` aligns with `.trellis/spec/frontend/quality.md:42-46` if warnings are introduced.

### Related Specs

- `.trellis/spec/frontend/quality.md` — frontend validation checklist and lint/typecheck expectations.
- `.trellis/spec/shared/code-quality.md` — shared code quality and pre-commit commands.
- `.trellis/spec/product/validation-and-testing.md` — product-level validation matrix and command signatures.
- `.trellis/spec/shared/git-conventions.md` — commit checklist includes lint passing.

## Caveats / Not Found

- No active Trellis task was reported by `task.py current --source`, but the user provided the explicit target path and requested this file.
- No repo-level Prettier or Biome config was found outside `node_modules`.
- Prettier is available transitively (`pnpm exec prettier --version` returned `3.8.3`) but is not listed as a direct dependency; relying on transitive CLI availability is not stable for project scripts.
- Biome is not installed (`pnpm exec biome --version` failed with command not found).
- External documentation was summarized from known official docs/reference pages; no live web fetch tool was available in this environment beyond local CLI/file tools.
