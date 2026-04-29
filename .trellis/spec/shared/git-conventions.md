# Git Conventions

> Git commit message format and branch naming conventions.

---

## Commit Message Format

This project uses **Conventional Commits**.

```
type(scope): description
type(scope)!: description

type: description

[optional body]

[optional footer]
```

Rules:

- Use a Conventional Commit type for every commit.
- Use a scope when it clarifies the affected area.
- Use `!` after the type/scope for breaking changes.
- Keep the description short and imperative.
- Put context, rationale, issue references, or breaking-change details in the body/footer.

### Types

| Type       | Description                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature                                             |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only                                      |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test`     | Adding or updating tests                                |
| `chore`    | Maintenance, generated files, or tooling                |
| `build`    | Build system or dependency changes                      |
| `ci`       | CI configuration or pipeline changes                    |
| `style`    | Formatting, missing semicolons, etc.                    |
| `perf`     | Performance improvement                                 |
| `revert`   | Revert a previous commit                                |

### Scopes

Scope should identify the affected area:

| Scope      | Description      |
| ---------- | ---------------- |
| `db`       | Database changes |
| `ipc`      | IPC handlers     |
| `ui`       | User interface   |
| `auth`     | Authentication   |
| `project`  | Project module   |
| `settings` | Settings module  |

### Examples

```bash
# Feature
feat(project): add project archive functionality

# Bug fix
fix(db): resolve migration timing issue

# Refactor
refactor(ipc): extract common validation logic

# Documentation
docs: update API documentation

# Chore
chore(deps): upgrade electron to v28

# Breaking change
feat(review)!: change review result schema
```

---

## Branch Naming

```
type/description
```

### Examples

```bash
# Feature branches
feat/project-archive
feat/dark-mode-support

# Bug fix branches
fix/login-crash
fix/db-migration-order

# Refactor branches
refactor/ipc-structure
refactor/type-definitions
```

---

## Commit Best Practices

### Keep Commits Atomic

Each commit should represent one logical change:

```bash
# GOOD - Separate commits
git commit -m "feat(project): add archive button to UI"
git commit -m "feat(project): implement archive procedure"
git commit -m "test(project): add archive procedure tests"

# BAD - Mixed changes
git commit -m "add archive feature and fix some bugs"
```

### Write Clear Descriptions

```bash
# GOOD - Clear description
feat(auth): add OAuth2 login with Google

# BAD - Vague
feat: update auth
```

### Use Body for Context

```bash
git commit -m "fix(db): handle null timestamps in migration

Previous migration assumed all records had timestamps.
This caused failures when upgrading from v1.0.

Fixes #123"
```

---

## Pre-Commit Checklist

Before committing:

- [ ] Code compiles (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Commit message follows Conventional Commits
- [ ] Changes are atomic

---

## Pull Request Guidelines

### Title Format

Same as commit message:

```
type(scope): description
```

### Description Template

```markdown
## Summary

Brief description of changes.

## Changes

- Added X
- Fixed Y
- Refactored Z

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing done

## Screenshots

(if applicable)
```

---

## Summary

| Convention     | Format                                | Example                              |
| -------------- | ------------------------------------- | ------------------------------------ |
| Commit message | Conventional Commit                   | `feat(auth): add login`              |
| Breaking commit| `type(scope)!: description`           | `feat(review)!: change schema`       |
| Branch name    | `type/description`                    | `feat/oauth-login`                   |
| Commit body    | Optional context                      | Multi-line explanation               |
| PR title       | Same as Conventional Commit           | `feat(auth): add OAuth login`        |
