import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writingAttempts, writingRevisions, reviewRuns, rewriteTasks } from '../src/main/db/schema';
import type {
  writingAttempts as writingAttemptsTable,
  writingRevisions as writingRevisionsTable,
  reviewRuns as reviewRunsTable,
  rewriteTasks as rewriteTasksTable,
} from '../src/main/db/schema';
import type { db as appDatabase } from '../src/main/db/client';
import type { generateStarterPrompt as generateStarterPromptFunction } from '../src/main/services/writing/service';

const mocks = vi.hoisted(() => ({
  getProviderApiKey: vi.fn(),
  generateText: vi.fn(),
  createOpenAI: vi.fn(),
  openAiChat: vi.fn((model: string) => ({ provider: 'openai-compatible', model })),
  storeGet: vi.fn(),
  storeSet: vi.fn(),
}));

type AppDatabase = typeof appDatabase;
type WritingAttemptRow = typeof writingAttemptsTable.$inferSelect;
type WritingRevisionRow = typeof writingRevisionsTable.$inferSelect;
type ReviewRunRow = typeof reviewRunsTable.$inferSelect;
type RewriteTaskRow = typeof rewriteTasksTable.$inferSelect;
type StoredRow = WritingAttemptRow | WritingRevisionRow | ReviewRunRow | RewriteTaskRow;
type TableName = 'writingAttempts' | 'writingRevisions' | 'reviewRuns' | 'rewriteTasks';

type RowStore = {
  writingAttempts: WritingAttemptRow[];
  writingRevisions: WritingRevisionRow[];
  reviewRuns: ReviewRunRow[];
  rewriteTasks: RewriteTaskRow[];
};

vi.mock('../src/main/db/client', () => ({
  db: fakeDatabase.asAppDatabase(),
  getDatabasePath: () => ':memory:',
  sqlite: {},
}));

vi.mock('../src/main/services/credentials/service', () => ({
  getProviderApiKey: mocks.getProviderApiKey,
  getProviderCredentialStatuses: async () => ({
    'openai-compatible': { providerId: 'openai-compatible', status: 'configured', storage: 'os-keychain' },
    anthropic: { providerId: 'anthropic', status: 'not-configured', storage: 'os-keychain' },
  }),
}));

vi.mock('electron-store', () => ({
  default: vi.fn(function MockStore() {
    return {
      get: mocks.storeGet,
      set: mocks.storeSet,
    };
  }),
}));

vi.mock('ai', () => ({
  generateText: mocks.generateText,
  Output: {
    object: vi.fn(() => ({ name: 'starter_prompt' })),
  },
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mocks.createOpenAI,
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(),
}));

const now = new Date('2026-04-30T12:00:00.000Z');
vi.setSystemTime(now);

const tableNames = new Map<object, TableName>([
  [writingAttempts, 'writingAttempts'],
  [writingRevisions, 'writingRevisions'],
  [reviewRuns, 'reviewRuns'],
  [rewriteTasks, 'rewriteTasks'],
]);

class FakeWritingDatabase {
  private store: RowStore = emptyStore();

  select(): {
    from: (table: unknown) => {
      where: (condition: unknown) => QueryResult;
      orderBy: () => { all: () => StoredRow[] };
      get: () => StoredRow | undefined;
      all: () => StoredRow[];
    };
  } {
    return {
      from: (table: unknown) => {
        const name = tableName(table);
        const rows = this.rowsFor(name);
        return {
          where: (condition: unknown) => this.queryRows(name, rows, condition),
          orderBy: () => ({ all: () => [...rows] }),
          get: () => rows[0],
          all: () => [...rows],
        };
      },
    };
  }

  insert(table: unknown): {
    values: (value: unknown) => { returning: () => { get: () => StoredRow } };
  } {
    return {
      values: (value: unknown) => {
        const row = { ...(value as Record<string, unknown>), createdAt: now, updatedAt: now } as StoredRow;
        this.rowsFor(tableName(table)).push(row);
        return { returning: () => ({ get: () => row }) };
      },
    };
  }

  update(table: unknown): {
    set: (patch: unknown) => {
      where: (condition: unknown) => { run: () => void; returning: () => { get: () => StoredRow | undefined } };
    };
  } {
    return {
      set: (patch: unknown) => ({
        where: (condition: unknown) => {
          const updated = this.updateRow(tableName(table), extractId(condition), patch);
          return {
            run: () => undefined,
            returning: () => ({ get: () => updated }),
          };
        },
      }),
    };
  }

  reset(): void {
    this.store = emptyStore();
  }

  attempts(): WritingAttemptRow[] {
    return [...this.store.writingAttempts];
  }

  asAppDatabase(): AppDatabase {
    return this as unknown as AppDatabase;
  }

  private rowsFor(table: TableName): StoredRow[] {
    return this.store[table] as StoredRow[];
  }

  private queryRows(table: TableName, rows: StoredRow[], condition: unknown): QueryResult {
    const value = extractId(condition);
    if (table === 'writingAttempts') {
      return new QueryResult(this.store.writingAttempts.filter((row) => row.id === value || row.dateKey === value));
    }

    return new QueryResult(rows.filter((row) => row.id === value));
  }

  private updateRow(table: TableName, id: string, patch: unknown): StoredRow | undefined {
    const row = this.rowsFor(table).find((candidate) => candidate.id === id);
    if (!row) {
      return undefined;
    }

    Object.assign(row, patch, table === 'writingAttempts' || table === 'reviewRuns' ? { updatedAt: now } : {});
    return row;
  }
}

class QueryResult {
  constructor(private readonly rows: StoredRow[]) {}

  get(): StoredRow | undefined {
    return this.rows[0];
  }

  all(): StoredRow[] {
    return [...this.rows];
  }

  orderBy(): { all: () => StoredRow[] } {
    return { all: () => [...this.rows] };
  }
}

const fakeDatabase = new FakeWritingDatabase();

function emptyStore(): RowStore {
  return {
    writingAttempts: [],
    writingRevisions: [],
    reviewRuns: [],
    rewriteTasks: [],
  };
}

function tableName(table: unknown): TableName {
  const name = typeof table === 'object' && table !== null ? tableNames.get(table) : undefined;
  if (!name) {
    throw new Error('Unknown table');
  }
  return name;
}

function extractId(condition: unknown): string {
  if (typeof condition !== 'object' || condition === null || !('queryChunks' in condition)) {
    throw new Error('Unsupported where condition');
  }

  const param = findStringValue((condition as { queryChunks: unknown[] }).queryChunks);
  if (!param) {
    throw new Error('Unsupported where parameter');
  }

  return param;
}

function findStringValue(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'object' && value !== null && 'value' in value && typeof (value as { value?: unknown }).value === 'string') {
      return (value as { value: string }).value;
    }

    if (typeof value === 'object' && value !== null && 'queryChunks' in value) {
      const nestedValue = findStringValue((value as { queryChunks: unknown[] }).queryChunks);
      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
}

async function loadGenerateStarterPrompt(): Promise<typeof generateStarterPromptFunction> {
  const module = await import('../src/main/services/writing/service');
  return module.generateStarterPrompt;
}

describe('starter prompt generation service boundary', () => {
  beforeEach((): void => {
    fakeDatabase.reset();
    vi.clearAllMocks();
    mocks.openAiChat.mockImplementation((model: string) => ({ provider: 'openai-compatible', model }));
    mocks.createOpenAI.mockReturnValue({ chat: mocks.openAiChat });
    mocks.getProviderApiKey.mockResolvedValue('test-key');
    mocks.storeGet.mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        'writing-practice-starter-prompt-disclosure-acknowledged': true,
        rawResponseStorageEnabled: false,
        openAiCompatibleBaseUrl: 'https://provider.example/v1',
        openAiCompatibleModel: 'starter-model',
        anthropicModel: 'claude-sonnet-4-5',
        defaultProviderId: 'openai-compatible',
      };
      return values[key];
    });
    mocks.generateText.mockResolvedValue({
      output: { prompt: 'Describe a small habit that improved your English.' },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
      warnings: undefined,
      request: {},
      response: { id: 'response_1', timestamp: now, modelId: 'starter-model' },
      providerMetadata: undefined,
    });
  });

  it('generates and persists a starter prompt through the shared AI service without writing content', async () => {
    const generateStarterPrompt = await loadGenerateStarterPrompt();

    const result = await generateStarterPrompt({ templateId: 'cet4', userGoal: 'travel topic' });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.starterPrompt?.text).toBe('Describe a small habit that improved your English.');
    expect(fakeDatabase.attempts()[0]).toMatchObject({
      templateId: 'cet4',
      userGoal: 'travel topic',
    });
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: { provider: 'openai-compatible', model: 'starter-model' },
      system: expect.stringContaining('starter prompts'),
      prompt: expect.stringContaining('User-provided goal/topic: travel topic'),
      maxOutputTokens: 500,
      timeout: 45_000,
    }));
    const prompt = mocks.generateText.mock.calls[0]?.[0]?.prompt;
    expect(prompt).toContain('Template: CET-4 Writing');
    expect(prompt).not.toContain('writing_content');
  });

  it('returns a safe missing-key error before calling the provider', async () => {
    mocks.getProviderApiKey.mockResolvedValue(null);
    const generateStarterPrompt = await loadGenerateStarterPrompt();

    const result = await generateStarterPrompt({ templateId: 'journal' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('OpenAI-compatible provider API key is not configured. Add it in Settings before continuing.');
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('does not call the provider before starter disclosure acknowledgement', async () => {
    mocks.storeGet.mockImplementation((key: string) => key === 'writing-practice-starter-prompt-disclosure-acknowledged' ? false : undefined);
    const generateStarterPrompt = await loadGenerateStarterPrompt();

    const result = await generateStarterPrompt({ templateId: 'journal' });

    expect(result).toMatchObject({ success: false, disclosureRequired: true });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});
