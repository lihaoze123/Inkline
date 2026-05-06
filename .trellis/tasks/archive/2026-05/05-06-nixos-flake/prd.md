# Support NixOS Flake Packaging

## Goal

Support NixOS flake packaging for Inkline so a Nix user can enter the development environment and, if in MVP scope, build/run the Electron desktop app through flake outputs rather than relying only on ad-hoc local commands.

## What I already know

* The user asked to support NixOS flake packaging for this project.
* The repository already has `flake.nix` and `flake.lock`.
* Current `flake.nix` is a development-environment-only flake: it imports `nixpkgs` from `nixos-unstable`, fixes `system = "x86_64-linux"`, builds an FHS environment, and exposes only `devShells.${system}.default`.
* The app is a local-first Electron desktop app named Inkline.
* The package manager is `pnpm@10.23.0`; `package.json` requires Node `>=22.0.0` and pnpm `>=9.0.0`.
* `.npmrc` uses a hoisted pnpm layout and `shamefully-hoist=true` for Electron/native-module compatibility.
* `postinstall` runs `electron-rebuild -o better-sqlite3,keytar`.
* Packaging scripts are `pnpm package` / `pnpm build` for `electron-forge package` and `pnpm make` for maker artifacts.
* Electron Forge config includes native modules `better-sqlite3`, `bindings`, `file-uri-to-path`, and `keytar`, plus Drizzle/resources as packaged extra resources.
* Linux makers include Debian package and AppImage makers; cross-platform makers include NSIS and DMG where supported.
* README currently documents `pnpm install`, `pnpm dev`, `pnpm package`, and `pnpm make`, but not Nix flake usage.

## Assumptions (temporary)

* The first target platform is NixOS/Linux, not macOS or Windows Nix builds.
* The existing FHS shell exists because Electron and native modules need runtime/build libraries on NixOS.
* A useful flake should keep developer workflow fast and should not require changing the application source code unless packaging exposes an actual bug.

## Open Questions

* None for current MVP.

## Requirements

* Preserve or improve the existing NixOS developer shell for Electron development.
* Keep pnpm as the package manager.
* Support native Electron modules (`better-sqlite3`, `keytar`) under NixOS.
* Expose a flake package output so another flake can install Inkline via this repository URL/input, e.g. by referencing `inputs.inkline.packages.${system}.default`.
* Expose a runnable flake app output if practical, so `nix run` can launch Inkline from the repository flake.
* Keep the package install path suitable for NixOS `environment.systemPackages`, Home Manager `home.packages`, or equivalent package-list usage.
* Document flake input installation examples in README.
* Avoid broad product behavior changes unrelated to Nix packaging.

## Acceptance Criteria

* [ ] `nix develop` provides a working shell with Node, pnpm/corepack, native build tooling, and Electron runtime libraries.
* [ ] Flake outputs are not hard-coded to only one Linux system unless an upstream dependency blocks broader support.
* [ ] `nix build` produces a runnable Inkline package output.
* [ ] The package output can be referenced as a flake input package from another NixOS/Home Manager configuration.
* [ ] `nix run` starts Inkline or a documented package wrapper.
* [ ] README documents the supported Nix commands, flake input installation example, and known NixOS caveats.
* [ ] Existing quality checks still pass or any unavailable checks are explicitly documented.

## Definition of Done

* Tests/checks relevant to packaging are run (`nix flake check`, `nix develop`, and/or `nix build` depending on chosen scope).
* Existing JS quality checks are not broken by packaging changes.
* README/docs are updated if user-facing commands change.
* Rollback is straightforward: the task should mostly affect flake/docs packaging files.

## Technical Approach

Implement the flake around a Nix-installable Linux desktop package:

* Keep the existing FHS devShell pattern for local Electron development.
* Add per-system outputs for common Linux systems where dependencies allow it.
* Add `packages.default` for Inkline so downstream flakes can install the package from this repository input.
* Add `apps.default` for `nix run` by pointing to the installed executable.
* Use pnpm-oriented Nix packaging (`fetchPnpmDeps` / `pnpmConfigHook`) or a Forge-under-Nix wrapper pattern rather than switching package managers.
* Prefer wrapping nixpkgs Electron around packaged app resources if direct Forge binary packaging is too brittle for NixOS.
* Update README with direct `nix build` / `nix run` commands and downstream flake input installation examples.

## Decision (ADR-lite)

**Context**: The existing flake only supports `nix develop`; the user wants installation through a flake input pointing at this repository.

**Decision**: MVP targets a first-class flake package/app output, not a devShell-only change. The package should be consumable as `inputs.inkline.packages.${system}.default` from NixOS/Home Manager or equivalent downstream flakes.

**Consequences**: This is higher risk than devShell-only because Electron ABI/native modules and Electron runtime wrapping must be handled under Nix. It provides the right public flake interface for installation and leaves CI/binary cache/release artifact work for later.

## Out of Scope (explicit)

* Cross-building Windows/macOS installers through Nix unless explicitly selected later.
* Changing Inkline product behavior, AI provider behavior, database behavior, or learning flows.
* Replacing pnpm with npm/yarn/bun.
* Publishing binary caches or CI release pipelines unless explicitly selected later.

## Technical Notes

* `package.json` scripts and dependencies inspected.
* `flake.nix` inspected: current output is `devShells.x86_64-linux.default = electronDevEnv.env`.
* `forge.config.ts` inspected: Electron Forge Vite plugin, native module copy hook, and Linux makers are configured.
* `README.md` inspected: package commands exist, Nix commands absent.

## Research References

* [`research/nix-electron-pnpm-packaging.md`](research/nix-electron-pnpm-packaging.md) — DevShell-only is lowest-friction; Nix-native packaging should use pnpm hooks and likely wrap nixpkgs Electron around Forge output.
* Context7 `/nixos/nixpkgs` docs — current Nixpkgs JavaScript guidance recommends `fetchPnpmDeps` + `pnpmConfigHook` with pinned pnpm versions such as `pnpm_10` for `pnpm-lock.yaml` projects.

## Research Notes

### What similar Nix packaging does

* Electron projects often start with an FHS development shell when upstream Electron tooling expects non-Nix library paths.
* Reproducible pnpm package derivations use `fetchPnpmDeps`, `pnpmConfigHook`, and a pinned pnpm package such as `pnpm_10`.
* Nix-native Electron apps commonly package app resources, then wrap nixpkgs Electron rather than shipping Electron's downloaded binary.
* Forge-generated `.deb`/AppImage artifacts are useful release outputs, but are not the same as a clean Nix `packages.default` app output.

### Constraints from this repo/project

* The existing flake already provides a broad FHS devShell but is hard-coded to `x86_64-linux` and does not expose `packages` or `apps`.
* Native modules must be rebuilt for Electron ABI; `keytar` needs `libsecret`/`pkg-config` and `better-sqlite3` needs native build tooling.
* The repo's `.npmrc` hoisted layout is intentional for Electron/native-module compatibility and should be preserved.
* Running `pnpm make` on Linux also needs maker tools such as `squashfs-tools`, `fakeroot`, and `dpkg`.

### Feasible approaches here

**Approach A: DevShell + docs MVP**

* How it works: improve the existing flake devShell, make it multi-system where practical, add missing Linux maker tools, and document `nix develop` + `pnpm` workflows.
* Pros: lowest risk, aligns with current repo, most likely to work quickly on NixOS.
* Cons: `nix build` does not produce Inkline; less reproducible as packaging.

**Approach B: DevShell + Forge artifact package**

* How it works: keep/improve the devShell and add a flake package that runs the existing Electron Forge packaging flow under Nix, initially targeting Linux unpacked app and/or maker artifacts.
* Pros: closer to user-facing packaging; reuses Forge config and native-module copy hooks.
* Cons: more brittle because Forge/Electron downloads, native rebuilds, and maker tools must be controlled inside Nix.

**Approach C: Nix-native wrapped Electron app**

* How it works: use `fetchPnpmDeps`/`pnpmConfigHook`, build app resources under Nix, then expose `packages.default` and `apps.default` by wrapping nixpkgs Electron around the packaged app resources.
* Pros: best long-term Nix integration; enables `nix build`/`nix run` as first-class outputs.
* Cons: highest implementation risk; requires Electron version alignment and careful native module ABI handling.
