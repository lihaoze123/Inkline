# Electron Development Guidelines

Universal development guidelines extracted from production Electron projects.

## Structure

### [Product](./product/index.md)

English Journal Coach product contracts extracted from the PRD:

- [MVP Scope](./product/mvp-scope.md)
- [Learning Flow](./product/learning-flow.md)
- [Review Agent Contract](./product/review-agent-contract.md)
- [Data Model Contract](./product/data-model-contract.md)
- [Privacy and Security](./product/privacy-security.md)
- [Validation and Testing](./product/validation-and-testing.md)

### [Frontend](./frontend/index.md)

React + TypeScript frontend development patterns:

- [Directory Structure](./frontend/directory-structure.md)
- [Components](./frontend/components.md)
- [State Management](./frontend/state-management.md)
- [Hooks](./frontend/hooks.md)
- [IPC Communication](./frontend/ipc-electron.md)
- [CSS Design](./frontend/css-design.md)
- [Type Safety](./frontend/type-safety.md)
- [React Pitfalls](./frontend/react-pitfalls.md)
- [Electron Browser API Restrictions](./frontend/electron-browser-api-restrictions.md)

### [Backend](./backend/index.md)

Electron main process development patterns:

- [Directory Structure](./backend/directory-structure.md)
- [API Module](./backend/api-module.md)
- [API Patterns](./backend/api-patterns.md)
- [Database](./backend/database.md)
- [Logging](./backend/logging.md)
- [Error Handling](./backend/error-handling.md)
- [Pagination](./backend/pagination.md)
- [Environment](./backend/environment.md)
- [Type Safety](./backend/type-safety.md)
- [macOS Permissions](./backend/macos-permissions.md)
- [Text Input](./backend/text-input.md)

### [Shared](./shared/index.md)

Cross-cutting concerns:

- [TypeScript Conventions](./shared/typescript.md)
- [Code Quality](./shared/code-quality.md)
- [Git Conventions](./shared/git-conventions.md)
- [Timestamp Handling](./shared/timestamp.md)
- [pnpm + Electron Setup](./shared/pnpm-electron-setup.md)

### [Guides](./guides/index.md)

Development thinking guides:

- [Pre-Implementation Checklist](./guides/pre-implementation-checklist.md)
- [Cross-Layer Thinking Guide](./guides/cross-layer-thinking-guide.md)
- [Code Reuse Thinking Guide](./guides/code-reuse-thinking-guide.md)
- [Bug Root Cause Thinking Guide](./guides/bug-root-cause-thinking-guide.md)
- [DB Schema Change Guide](./guides/db-schema-change-guide.md)
- [Transaction Consistency Guide](./guides/transaction-consistency-guide.md)
- [Semantic Change Checklist](./guides/semantic-change-checklist.md)

### [Big Questions / Pitfalls](./big-question/index.md)

Common issues and solutions:

- [Native Module Packaging](./big-question/native-module-packaging.md)
- [Native Module Complex Dependencies](./big-question/native-module-complex-deps.md)
- [IPC Handler Registration](./big-question/ipc-handler-registration.md)
- [Network Stack Differences](./big-question/network-stack-differences.md)
- [Transaction Silent Failure](./big-question/transaction-silent-failure.md)
- [React useState Function](./big-question/react-usestate-function.md)
- [CSS Flex Centering](./big-question/css-flex-centering.md)
- [Timestamp Precision](./big-question/timestamp-precision.md)
- [Bluetooth HID Device](./big-question/bluetooth-hid-device.md)
- [Global Keyboard Hooks](./big-question/global-keyboard-hooks.md)

## Tech Stack

- **Product**: Local-first English journal coach with pi-mono agent runtime
- **Frontend**: React 18, TypeScript, TanStack Query, Tailwind CSS
- **Backend**: Electron (Main Process), SQLite, TypeScript
- **IPC**: Type-safe contextBridge pattern
- **Agent contract**: Zod-validated structured JSON; app owns persistence
- **Build**: Vite, electron-builder

## Usage

These guidelines can be used as:

1. **New Project Template** - Copy the entire structure for new Electron projects
2. **Reference Documentation** - Consult specific guides when implementing features
3. **Code Review Checklist** - Verify implementations against established patterns
4. **Onboarding Material** - Help new developers understand project conventions
