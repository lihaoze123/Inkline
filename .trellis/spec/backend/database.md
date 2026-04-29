# Database Guidelines (Drizzle + SQLite)

> Guidelines for Drizzle ORM and SQLite development in Electron.

---

## Drizzle Client Setup

```typescript
// src/main/db/client.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import * as schema from './schema';

const getDbPath = () => {
  if (process.env.NODE_ENV === 'development') {
    return './app-dev.db';
  }
  return path.join(app.getPath('userData'), 'app.db');
};

const sqlite = new Database(getDbPath());
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };
```

---

## Schema Definition

```typescript
// src/main/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['active', 'archived', 'draft'] })
    .default('active')
    .notNull(),
  // Use timestamp_ms for millisecond precision
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date()),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// Relations for db.query.* API
export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
}));

// Export types
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
```

---

## Timestamp Precision

**CRITICAL: Always use `{ mode: 'timestamp_ms' }` for timestamps.**

```typescript
// BAD: Using seconds mode
createdAt: integer('createdAt', { mode: 'timestamp' }); // Stores 1734019200

// GOOD: Using milliseconds mode
createdAt: integer('createdAt', { mode: 'timestamp_ms' }); // Stores 1734019200000
```

---

## Query Patterns

```typescript
// Single result
const user = db.select().from(users).where(eq(users.id, id)).get();

// Multiple results
const allUsers = db.select().from(users).all();

// Insert with return
const newUser = db.insert(users).values(data).returning().get();

// Relational queries
const projectsWithTasks = db.query.projects.findMany({
  with: { tasks: true },
});

// Transaction
db.transaction((tx) => {
  tx.insert(projects).values(projectData).run();
  tx.insert(tasks).values(taskData).run();
});

// Batch lookup (avoid N+1)
const results = db.select().from(items).where(inArray(items.id, ids)).all();
```

---

## Migrations

```typescript
// src/main/db/migrate.ts
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './client';
import { existsSync } from 'fs';
import path from 'path';

export function runMigrations() {
  const migrationsFolder =
    process.env.NODE_ENV === 'development'
      ? path.resolve(__dirname, '..', '..', 'drizzle')
      : path.join(process.resourcesPath, 'drizzle');

  if (!existsSync(migrationsFolder)) {
    return { success: false, reason: 'missing-folder' };
  }

  try {
    migrate(db, { migrationsFolder });
    return { success: true };
  } catch (error) {
    return { success: false, reason: 'error', error: error.message };
  }
}
```

---

## Scenario: Local App Data SQLite Foundation

### 1. Scope / Trigger

- Trigger: Any Electron foundation or persistence task that creates/changes the local SQLite client, migration runner, packaged migration resources, or v0.1 foundation tables.
- Main process owns SQLite. Renderer and preload must not import `better-sqlite3`, Drizzle clients, schema modules, `node:fs`, or database paths directly.

### 2. Signatures

- Database path: `getDatabasePath(): string`
  - Returns `path.join(app.getPath('userData'), 'english-coach.sqlite')`.
  - Dev/prod isolation comes from `env-setup` changing `app.getPath('userData')` before database initialization.
- Client exports:
  - `export const db = drizzle(sqlite, { schema })`
  - `export { sqlite }`
- Migration runner: `runMigrations(): MigrationResult`

```typescript
type MigrationResult =
  | { success: true }
  | { success: false; reason: 'missing-folder' | 'error'; error?: string };
```

- Required v0.1 foundation tables:
  - `journal_entries`
  - `review_runs`
  - `corrections`
  - `rewrite_tasks`

### 3. Contracts

- SQLite pragmas:
  - `journal_mode = WAL`
  - `foreign_keys = ON`
- Migration folders:
  - Dev: `path.resolve(process.cwd(), 'drizzle')`
  - Packaged: `path.join(process.resourcesPath, 'drizzle')`
- Packaging contract:
  - Electron Forge must include `drizzle` in `packagerConfig.extraResource` so packaged apps can run migrations.
- Table contract:
  - Primary keys are `TEXT` IDs.
  - Timestamp columns store Unix milliseconds using Drizzle `integer(..., { mode: 'timestamp_ms' })`.
  - Review raw output, if present, is stored locally only and is governed by the off-by-default raw-response setting.
  - Provider API keys must not appear as SQLite tables or columns.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Migration folder missing | Return `{ success: false, reason: 'missing-folder' }` |
| Drizzle migration throws | Return `{ success: false, reason: 'error', error: message }` |
| Migration succeeds | Return `{ success: true }` |
| API-key table/column proposed | Reject the schema; use OS keychain service instead |
| Timestamp column proposed without `timestamp_ms` | Reject the schema; use Unix milliseconds |

### 5. Good/Base/Bad Cases

- Good: Dev app opens `english-coach.sqlite` under the dev-isolated `userData` directory, applies migrations from repo `drizzle`, and stores no provider secrets in SQL.
- Base: Packaged app opens the production `userData` database and applies migrations from `process.resourcesPath/drizzle`.
- Bad: Migration lookup depends on Vite output-relative paths, so packaged apps cannot find `drizzle`.
- Bad: Renderer imports schema or database modules to display local status.

### 6. Tests Required

- Database contract test:
  - Assert migration SQL creates all required v0.1 foundation tables.
  - Assert timestamp defaults use millisecond precision.
  - Assert foreign keys exist for review/correction/rewrite relationships.
  - Assert migration SQL does not create API-key tables or columns.
- Build smoke test:
  - Run Electron package build and verify migrations are included as packaged resources.
- Settings/privacy test:
  - Assert raw response storage defaults to `false`.

### 7. Wrong vs Correct

#### Wrong

```typescript
const migrationsFolder = path.resolve(__dirname, '..', '..', 'drizzle');
```

This works only when runtime output layout happens to match source assumptions.

#### Correct

```typescript
const migrationsFolder = app.isPackaged
  ? path.join(process.resourcesPath, 'drizzle')
  : path.resolve(process.cwd(), 'drizzle');
```

Pair this with `packagerConfig.extraResource = ['drizzle']` so packaged builds have the same migration contract as development.

## Quick Reference

| Operation     | Method                  |
| ------------- | ----------------------- |
| Single        | `.get()`                |
| Multiple      | `.all()`                |
| Insert/Update | `.run()`                |
| With return   | `.returning().get()`    |
| Relational    | `db.query.*.findMany()` |

| Rule               | Reason                |
| ------------------ | --------------------- |
| Use `timestamp_ms` | Match JavaScript Date |
| Use transactions   | Atomic operations     |
| Use `inArray`      | Avoid N+1 queries     |
| Filter `isDeleted` | Exclude soft-deleted  |
