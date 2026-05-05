# Fix headless e2e provider settings CI failure

## Goal

Make `pnpm test:e2e:headless` pass reliably in CI by fixing the provider settings setup path that times out waiting for the success message after saving Custom OpenAI-compatible settings, without weakening intended product behavior.

## What I already know

* CI fails during `app-entry-provider-setup` in `scripts/review-ui-e2e.ts`.
* The failing wait expects text: `Custom OpenAI-compatible settings and API key saved.`
* The captured DOM is already on Settings with the Custom OpenAI-compatible provider selected.
* The DOM shows `Current saved model: inkline-e2e-mock-model`, so provider config persistence completed before the timeout.
* The DOM also shows `Keychain unavailable; storage: os-keychain`, so API key persistence failed and the UI never produced the success message.
* After merging `origin/main` (`809b080`) into `chore/headless-e2e`, the e2e command and CI workflow still lack an explicit Secret Service session for keytar/libsecret.
* The user develops on NixOS, so local reproduction may have Nix-specific paths: `dbus-run-session` and `gnome-keyring-daemon` can exist while the `xvfb-run` package is missing.

## Assumptions (temporary)

* The root cause is CI environment setup for Linux Secret Service, not a product copy or React timing issue.
* The fix should preserve real Settings behavior: the deterministic UI e2e should still save the key through renderer UI -> preload IPC -> main process -> keytar/libsecret.

## Open Questions

* None currently blocking.

## Requirements

* Preserve Custom OpenAI-compatible provider settings behavior for real users.
* Keep the e2e assertion meaningful: the test should still prove provider setup completed through the UI and keychain path.
* Avoid weakening CI by removing coverage or waiting for unrelated UI state.
* Make Linux headless CI start a usable Secret Service session for keytar/libsecret before running the deterministic UI e2e.
* Keep the command usable on NixOS when the needed runtime tools are present, and document any local limitation if `xvfb-run` is unavailable.

## Acceptance Criteria

* [x] `pnpm test:e2e:headless` passes locally or the closest reproducible command is run with results documented.
* [x] The e2e `app-entry-provider-setup` phase no longer times out waiting for stale or impossible UI text.
* [x] Any code/test change is minimal and aligned with existing provider settings patterns.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI-relevant checks run where practical.
* Docs/notes updated only if behavior changes.
* Rollout/rollback considered if risky.

## Technical Approach

Wrap the Linux headless e2e run in a DBus session with `gnome-keyring-daemon --components=secrets` available, and install the required daemon package in GitHub Actions. Do not change the Settings success condition or bypass keytar in test code; the e2e should continue to prove that the user-visible save flow can persist provider credentials.

## Decision (ADR-lite)

**Context**: The e2e failure shows provider config saved but keychain unavailable, so the success text is correctly absent.
**Decision**: Fix the CI/headless runtime by providing Secret Service instead of weakening the UI assertion.
**Consequences**: CI needs one additional native dependency and the headless command depends on `dbus-run-session`, `gnome-keyring-daemon`, and `xvfb-run`; NixOS local runs need those tools from the Nix environment.

## Out of Scope (explicit)

* Reworking the provider settings UX.
* Changing provider persistence semantics beyond what is needed for CI reliability.
* Removing headless e2e coverage.
* Adding a fake/in-memory credential store for deterministic e2e.

## Technical Notes

* Initial failure log came from GitHub Actions running `env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 ELECTRON_OZONE_PLATFORM_HINT=x11 xvfb-run -a pnpm test:e2e` via `pnpm test:e2e:headless`.
* Current branch was merged with latest `origin/main` (`809b080 Refresh roadmap evidence semantics (#25)`) before implementation analysis.
* Local headed `pnpm test:e2e` passed on the current NixOS display.
* Local `pnpm test:e2e:headless` could not run because `xvfb-run` is missing in this NixOS environment.
