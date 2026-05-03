import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { resolve } from 'node:path';
import { clearTimeout, setTimeout } from 'node:timers';
import type { Buffer } from 'node:buffer';
import { pathToFileURL } from 'node:url';
import { E2E_REVIEW_SAMPLE_WRITING } from '../test/fixtures/review-provider-e2e';
import type { AiProviderDiagnostics } from '../src/shared/types/ai';

const REQUIRED_ENV = [
  'E2E_OPENAI_COMPATIBLE_API_KEY',
  'E2E_OPENAI_COMPATIBLE_BASE_URL',
  'E2E_OPENAI_COMPATIBLE_MODEL',
] as const;

const INCLUDE_THINKING_ENV = 'E2E_OPENAI_COMPATIBLE_INCLUDE_THINKING';
const CDP_PORT_ENV = 'E2E_CDP_PORT';
const KEYCHAIN_SERVICE_ENV = 'INKLINE_KEYCHAIN_SERVICE_NAME';
const CDP_WAIT_TIMEOUT_MS = 120_000;
const RENDERER_EVAL_TIMEOUT_MS = 360_000;
const ELECTRON_EXIT_TIMEOUT_MS = 8_000;
const NIX_STORE_DIR = '/nix/store';
const LIBSECRET_SHARED_OBJECT = 'libsecret-1.so.0';

type E2EConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  includeThinking: boolean;
  cdpPortOverride: number | null;
};

type E2ECheck = {
  label: string;
  reviewThinkingEnabled: boolean;
  expectedReasoningEffort: 'none' | 'medium';
};

export type ElectronSession = {
  child: ChildProcess;
  cdpPort: number;
  tempRoot: string;
  xdgConfigHome: string;
  keychainServiceName: string;
  cdpProcessIds: Set<number>;
  recentOutput: () => string[];
};

type CdpTarget = {
  type?: string;
  url?: string;
  title?: string;
  webSocketDebuggerUrl?: string;
};

type CdpResponse = {
  id?: number;
  result?: unknown;
  error?: { message?: string };
  method?: string;
  params?: unknown;
};

type RuntimeEvaluateResponse = {
  result?: {
    result?: {
      type?: string;
      value?: unknown;
      description?: string;
    };
    exceptionDetails?: unknown;
  };
  error?: { message?: string };
};

type RendererCheckSummary = {
  check: string;
  success: boolean;
  schemaValid: boolean | null;
  validationStatus: string | null;
  correctionCount: number;
  referenceRewriteCount: number;
  rewritePracticeCount: number;
  reviewRun: {
    id: string | null;
    status: string | null;
    validationStatus: string | null;
  };
  diagnostics: E2EDiagnosticSummary | null;
  error: string | null;
};

type E2EDiagnosticSummary = {
  finishReason: string | null;
  rawFinishReason: string | null;
  usage: AiProviderDiagnostics['usage'];
  warningCount: number;
  responseId: string | null;
  responseModelId: string | null;
  providerMetadataKeys: string[];
  reasoningEnabled: boolean | null;
  reasoningEffort: string | null;
  reasoningRequestedEffort: string | null;
  reasoningEffectiveEffort: string | null;
  reasoningFallbackUsed: boolean;
  failureKind: string | null;
};

if (isMainModule()) {
  loadDotEnvFile(resolve(process.cwd(), '.env'));

  main().catch((error: unknown) => {
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          errorName: errorName(error),
          errorMessage: safeErrorMessage(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  });
}

async function main(): Promise<void> {
  const config = readConfig();
  if (!config) {
    return;
  }

  const cdpPort = config.cdpPortOverride ?? (await getFreePort());
  const session = await launchElectronSession(config, cdpPort);
  let cdp: CdpClient | null = null;

  try {
    const target = await waitForRendererTarget(session.cdpPort, session.recentOutput);
    cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await captureCdpProcessIds(cdp, session);
    await cdp.send('Runtime.enable');
    await waitForRendererApi(cdp);

    const checks: E2ECheck[] = [
      {
        label: 'review-thinking-default-disabled',
        reviewThinkingEnabled: false,
        expectedReasoningEffort: 'none',
      },
    ];

    if (config.includeThinking) {
      checks.push({
        label: 'review-thinking-enabled-medium',
        reviewThinkingEnabled: true,
        expectedReasoningEffort: 'medium',
      });
    }

    for (const check of checks) {
      const summary = await runRendererCheck(cdp, config, check);
      console.log(JSON.stringify(summary, null, 2));
      if (!summary.success || summary.validationStatus === 'invalid' || summary.schemaValid === false) {
        throw new Error(summary.error ?? 'E2E provider output did not pass the real review workflow validation.');
      }
      assertReasoningDiagnostics(check, summary.diagnostics);
    }
  } finally {
    if (cdp) {
      await bestEffortRendererCredentialCleanup(cdp);
      await bestEffortCloseBrowser(cdp);
      cdp.close();
    }
    await cleanupElectronSession(session);
  }
}

async function launchElectronSession(config: E2EConfig, cdpPort: number): Promise<ElectronSession> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'Inkline-e2e-'));
  const xdgConfigHome = path.join(tempRoot, 'xdg-config');
  const keychainServiceName = `Inkline-e2e-${randomUUID()}`;
  const outputLines: string[] = [];
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    XDG_CONFIG_HOME: xdgConfigHome,
    [KEYCHAIN_SERVICE_ENV]: keychainServiceName,
  };
  const nativeDependencyLdLibraryPath = buildNativeDependencyLdLibraryPath({
    currentLdLibraryPath: process.env.LD_LIBRARY_PATH,
  });
  if (nativeDependencyLdLibraryPath) {
    childEnv.LD_LIBRARY_PATH = nativeDependencyLdLibraryPath;
  }
  const child = spawn('pnpm', ['exec', 'electron-forge', 'start', '--', `--remote-debugging-port=${cdpPort}`], {
    cwd: process.cwd(),
    env: childEnv,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const recordOutput = (chunk: Buffer): void => {
    const sanitized = sanitizeLogText(chunk.toString('utf8'), config);
    for (const line of sanitized.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        outputLines.push(trimmed);
      }
    }
    while (outputLines.length > 80) {
      outputLines.shift();
    }
  };

  child.stdout?.on('data', recordOutput);
  child.stderr?.on('data', recordOutput);

  child.once('exit', (code, signal) => {
    outputLines.push(`Electron process exited before cleanup. code=${code ?? 'null'} signal=${signal ?? 'null'}`);
  });

  return {
    child,
    cdpPort,
    tempRoot,
    xdgConfigHome,
    keychainServiceName,
    cdpProcessIds: new Set(),
    recentOutput: () => outputLines.slice(-20),
  };
}

export async function waitForRendererTarget(port: number, recentOutput: () => string[]): Promise<Required<CdpTarget>> {
  const startedAt = Date.now();
  let lastError = 'CDP target list is not available yet.';

  while (Date.now() - startedAt < CDP_WAIT_TIMEOUT_MS) {
    try {
      const response = await globalThis.fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = (await response.json()) as CdpTarget[];
        const pageTarget = targets.find((target) => {
          return (
            target.type === 'page' &&
            typeof target.webSocketDebuggerUrl === 'string' &&
            isAppRendererTarget(target.url ?? '')
          );
        });

        if (pageTarget?.webSocketDebuggerUrl) {
          return {
            type: pageTarget.type ?? 'page',
            url: pageTarget.url ?? '',
            title: pageTarget.title ?? '',
            webSocketDebuggerUrl: pageTarget.webSocketDebuggerUrl,
          };
        }
        lastError = `CDP is up but no app page target was found. targetCount=${targets.length}`;
      } else {
        lastError = `CDP /json/list returned HTTP ${response.status}.`;
      }
    } catch (error) {
      lastError = safeErrorMessage(error);
    }
    await sleep(500);
  }

  throw new Error(
    `Timed out waiting for Electron renderer CDP target on port ${port}. ${lastError} Recent Electron output: ${recentOutput().join(' | ')}`,
  );
}

function isAppRendererTarget(url: string): boolean {
  if (url.startsWith('devtools://') || url.startsWith('chrome://')) {
    return false;
  }

  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://');
}

export async function waitForRendererApi(cdp: CdpClient): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < CDP_WAIT_TIMEOUT_MS) {
    const result = await cdp.evaluate('Boolean(window.api?.settings && window.api?.review && window.api?.writing)');
    if (result === true) {
      return;
    }
    await sleep(250);
  }

  throw new Error('Timed out waiting for window.api in the Electron renderer.');
}

async function runRendererCheck(cdp: CdpClient, config: E2EConfig, check: E2ECheck): Promise<RendererCheckSummary> {
  const payload = {
    check,
    provider: {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
    },
    writingContent: E2E_REVIEW_SAMPLE_WRITING,
  };
  const result = await cdp.evaluate(`(${RENDERER_CHECK_SCRIPT})(${JSON.stringify(payload)})`, RENDERER_EVAL_TIMEOUT_MS);
  if (!isRendererCheckSummary(result)) {
    throw new Error('Renderer E2E returned an unexpected summary shape.');
  }
  return result;
}

const RENDERER_CHECK_SCRIPT = String.raw`async (payload) => {
  const api = window.api;
  const summarizeDiagnostics = (diagnostics) => {
    if (!diagnostics) {
      return null;
    }

    return {
      finishReason: diagnostics.finishReason,
      rawFinishReason: diagnostics.rawFinishReason,
      usage: diagnostics.usage,
      warningCount: diagnostics.warningCount,
      responseId: diagnostics.responseId,
      responseModelId: diagnostics.responseModelId,
      providerMetadataKeys: diagnostics.providerMetadataKeys,
      reasoningEnabled: diagnostics.reasoningEnabled,
      reasoningEffort: diagnostics.reasoningEffort,
      reasoningRequestedEffort: diagnostics.reasoningRequestedEffort,
      reasoningEffectiveEffort: diagnostics.reasoningEffectiveEffort,
      reasoningFallbackUsed: diagnostics.reasoningFallbackUsed,
      failureKind: diagnostics.failureKind,
    };
  };

  try {
    await api.settings.setProviderConfig({
      providerId: 'openai-compatible',
      baseUrl: payload.provider.baseUrl,
      model: payload.provider.model,
    });
    await api.settings.setDefaultProvider({ providerId: 'openai-compatible' });
    const credentialResult = await api.credentials.setProviderApiKey({
      providerId: 'openai-compatible',
      apiKey: payload.provider.apiKey,
    });
    if (!credentialResult.success) {
      return {
        check: payload.check.label,
        success: false,
        schemaValid: null,
        validationStatus: null,
        correctionCount: 0,
        referenceRewriteCount: 0,
        rewritePracticeCount: 0,
        reviewRun: { id: null, status: null, validationStatus: null },
        diagnostics: null,
        error: credentialResult.error ?? 'Unable to save provider API key.',
      };
    }

    await api.settings.setReviewThinking({ enabled: payload.check.reviewThinkingEnabled });
    await api.review.acknowledgeDisclosure({ acknowledged: true });
    const writing = await api.writing.saveWritingAttempt({
      templateId: 'journal',
      content: payload.writingContent,
      userGoal: 'Practice past tense and natural place references.',
    });
    const activeRevision = writing.activeRevision;
    if (!activeRevision) {
      throw new Error('No active writing revision was saved.');
    }

    const review = await api.review.start({
      writingAttemptId: writing.attemptId,
      writingRevisionId: activeRevision.id,
    });
    const reviewRun = review.reviewRun ?? null;
    const preview =
      review.preview ??
      (reviewRun
        ? await api.review.getPreview({
            reviewRunId: reviewRun.id,
          })
        : null);
    const diagnostics = reviewRun?.summary?.providerDiagnostics ?? null;

    return {
      check: payload.check.label,
      success: review.success === true && Boolean(preview),
      schemaValid: preview ? true : review.success === true ? null : false,
      validationStatus: preview?.reviewRun.validationStatus ?? reviewRun?.validationStatus ?? null,
      correctionCount: preview?.operations.corrections.length ?? 0,
      referenceRewriteCount: preview?.operations.referenceRewrites.length ?? 0,
      rewritePracticeCount: preview?.operations.rewritePractice.length ?? 0,
      reviewRun: {
        id: reviewRun?.id ?? null,
        status: reviewRun?.status ?? null,
        validationStatus: reviewRun?.validationStatus ?? null,
      },
      diagnostics: summarizeDiagnostics(diagnostics),
      error: review.success === true ? null : (review.error ?? 'Review failed.'),
    };
  } catch (error) {
    return {
      check: payload.check.label,
      success: false,
      schemaValid: null,
      validationStatus: null,
      correctionCount: 0,
      referenceRewriteCount: 0,
      rewritePracticeCount: 0,
      reviewRun: { id: null, status: null, validationStatus: null },
      diagnostics: null,
      error: error instanceof Error ? error.message : 'Renderer E2E failed.',
    };
  }
}`;

async function bestEffortRendererCredentialCleanup(cdp: CdpClient): Promise<void> {
  try {
    await cdp.evaluate(
      "(async () => { if (window.api?.credentials?.deleteProviderApiKey) { await window.api.credentials.deleteProviderApiKey({ providerId: 'openai-compatible' }); } return true; })()",
      10_000,
    );
  } catch {
    // The child uses an isolated keychain service; cleanup is best effort.
  }
}

export async function bestEffortCloseBrowser(cdp: CdpClient): Promise<void> {
  try {
    await cdp.send('Browser.close', undefined, 10_000);
  } catch {
    // Browser shutdown is best effort; the process cleanup below is the fallback.
  }
}

export async function cleanupElectronSession(session: ElectronSession): Promise<void> {
  await stopChildProcess(session.child);
  await bestEffortKillCdpProcesses(session.cdpProcessIds, 'SIGTERM');
  await sleep(1_000);
  await bestEffortKillCdpProcesses(session.cdpProcessIds, 'SIGKILL');
  await bestEffortRemoveTempDir(session.tempRoot);
}

export async function captureCdpProcessIds(cdp: CdpClient, session: ElectronSession): Promise<void> {
  try {
    const response = (await cdp.send('SystemInfo.getProcessInfo', undefined, 10_000)) as {
      result?: { processInfo?: Array<{ id?: unknown }> };
    };
    for (const processInfo of response.result?.processInfo ?? []) {
      if (typeof processInfo.id === 'number' && Number.isInteger(processInfo.id) && processInfo.id > 0) {
        session.cdpProcessIds.add(processInfo.id);
      }
    }
  } catch {
    // Process ids are a cleanup optimization; CDP evaluation can proceed without them.
  }
}

async function bestEffortKillCdpProcesses(
  processIds: Set<number>,
  signal: Parameters<typeof process.kill>[1],
): Promise<void> {
  for (const processId of processIds) {
    try {
      process.kill(processId, signal);
    } catch {
      // Process may already be gone.
    }
  }
}

async function bestEffortRemoveTempDir(tempRoot: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(tempRoot, { recursive: true, force: true });
      return;
    } catch {
      await sleep(500);
    }
  }
}

async function stopChildProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.stdin?.end();

  const exited = new Promise<void>((resolvePromise) => {
    child.once('exit', () => resolvePromise());
  });

  try {
    if (process.platform !== 'win32' && typeof child.pid === 'number') {
      process.kill(-child.pid, 'SIGTERM');
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    return;
  }

  const stopped = await Promise.race([exited.then(() => true), sleep(ELECTRON_EXIT_TIMEOUT_MS).then(() => false)]);
  if (stopped) {
    return;
  }

  try {
    if (process.platform !== 'win32' && typeof child.pid === 'number') {
      process.kill(-child.pid, 'SIGKILL');
    } else {
      child.kill('SIGKILL');
    }
  } catch {
    // Process may already be gone.
  }
}

export class CdpClient {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: CdpResponse) => void;
      reject: (reason: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  private constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener('message', (event: MessageEvent<string>) => {
      const parsed = parseCdpMessage(event.data);
      if (!parsed || typeof parsed.id !== 'number') {
        return;
      }

      const pending = this.pending.get(parsed.id);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeout);
      this.pending.delete(parsed.id);
      pending.resolve(parsed);
    });
    this.socket.addEventListener('close', () => {
      for (const [id, pending] of this.pending.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`CDP websocket closed before response ${id}.`));
      }
      this.pending.clear();
    });
  }

  static async connect(url: string): Promise<CdpClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolvePromise, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out connecting to CDP websocket.')), 15_000);
      socket.addEventListener(
        'open',
        () => {
          clearTimeout(timeout);
          resolvePromise();
        },
        { once: true },
      );
      socket.addEventListener(
        'error',
        () => {
          clearTimeout(timeout);
          reject(new Error('Failed to connect to CDP websocket.'));
        },
        { once: true },
      );
    });
    return new CdpClient(socket);
  }

  async send(method: string, params?: Record<string, unknown>, timeoutMs = 30_000): Promise<CdpResponse> {
    const id = this.nextId;
    this.nextId += 1;

    const responsePromise = new Promise<CdpResponse>((resolvePromise, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for CDP method ${method}.`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolvePromise, reject, timeout });
    });

    this.socket.send(JSON.stringify({ id, method, params }));
    const response = await responsePromise;
    if (response.error) {
      throw new Error(response.error.message ?? `CDP method ${method} failed.`);
    }
    return response;
  }

  async evaluate(expression: string, timeoutMs = 30_000): Promise<unknown> {
    const response = (await this.send(
      'Runtime.evaluate',
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      },
      timeoutMs,
    )) as RuntimeEvaluateResponse;

    if (response.error) {
      throw new Error(response.error.message ?? 'CDP Runtime.evaluate failed.');
    }

    if (response.result?.exceptionDetails) {
      throw new Error(`Renderer evaluation failed: ${summarizeRuntimeException(response.result.exceptionDetails)}`);
    }

    const result = response.result?.result;
    if (!result) {
      throw new Error('Renderer evaluation returned no result.');
    }

    return result.value;
  }

  close(): void {
    this.socket.close();
  }
}

export async function getFreePort(): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to allocate a CDP port.'));
        return;
      }
      const port = address.port;
      server.close(() => resolvePromise(port));
    });
    server.on('error', reject);
  });
}

export function buildNativeDependencyLdLibraryPath(options: {
  currentLdLibraryPath?: string;
  nixStoreDir?: string;
}): string | undefined {
  const currentLdLibraryPath = options.currentLdLibraryPath;
  const existingDirs = splitLibraryPath(currentLdLibraryPath);
  if (existingDirs.some((dir) => existsSync(path.join(dir, LIBSECRET_SHARED_OBJECT)))) {
    return currentLdLibraryPath && currentLdLibraryPath.length > 0 ? currentLdLibraryPath : undefined;
  }

  const libsecretDir = findNixLibsecretLibraryDir(options.nixStoreDir ?? NIX_STORE_DIR);
  if (!libsecretDir) {
    return currentLdLibraryPath && currentLdLibraryPath.length > 0 ? currentLdLibraryPath : undefined;
  }

  if (existingDirs.includes(libsecretDir)) {
    return currentLdLibraryPath && currentLdLibraryPath.length > 0 ? currentLdLibraryPath : libsecretDir;
  }

  return currentLdLibraryPath && currentLdLibraryPath.length > 0
    ? `${libsecretDir}${path.delimiter}${currentLdLibraryPath}`
    : libsecretDir;
}

function splitLibraryPath(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.split(path.delimiter).filter((entry) => entry.length > 0);
}

function findNixLibsecretLibraryDir(nixStoreDir: string): string | null {
  if (!existsSync(nixStoreDir)) {
    return null;
  }

  let entries: Array<{ isDirectory: boolean; name: string }>;
  try {
    entries = readdirSync(nixStoreDir, { withFileTypes: true }).map((entry) => ({
      isDirectory: entry.isDirectory(),
      name: entry.name,
    }));
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory || !entry.name.includes('libsecret')) {
      continue;
    }

    const libDir = path.join(nixStoreDir, entry.name, 'lib');
    if (existsSync(path.join(libDir, LIBSECRET_SHARED_OBJECT))) {
      return libDir;
    }
  }

  return null;
}

function readConfig(): E2EConfig | null {
  const missing = REQUIRED_ENV.filter((name) => !envValue(name));
  if (missing.length > 0) {
    console.log(
      JSON.stringify(
        {
          status: 'skipped',
          reason: 'Missing required environment variables for live review provider e2e.',
          missing,
          envFileLoaded: existsSync(resolve(process.cwd(), '.env')),
        },
        null,
        2,
      ),
    );
    return null;
  }

  return {
    apiKey: envValue('E2E_OPENAI_COMPATIBLE_API_KEY') ?? '',
    baseUrl: envValue('E2E_OPENAI_COMPATIBLE_BASE_URL') ?? '',
    model: envValue('E2E_OPENAI_COMPATIBLE_MODEL') ?? '',
    includeThinking: booleanEnvValue(INCLUDE_THINKING_ENV),
    cdpPortOverride: readOptionalPort(CDP_PORT_ENV),
  };
}

function readOptionalPort(name: string): number | null {
  const raw = envValue(name);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`${name} must be an integer TCP port between 1 and 65535.`);
  }
  return parsed;
}

function assertReasoningDiagnostics(check: E2ECheck, diagnostics: E2EDiagnosticSummary | null): void {
  if (!diagnostics) {
    throw new Error('E2E provider response did not include provider diagnostics.');
  }

  if (check.expectedReasoningEffort === 'none') {
    if (diagnostics.reasoningFallbackUsed) {
      if (
        diagnostics.reasoningRequestedEffort !== 'none' ||
        diagnostics.reasoningEffectiveEffort !== null ||
        diagnostics.reasoningEffort !== null
      ) {
        throw new Error('E2E default reasoning fallback diagnostics are inconsistent.');
      }
      return;
    }

    if (
      diagnostics.reasoningRequestedEffort !== 'none' ||
      diagnostics.reasoningEffectiveEffort !== 'none' ||
      diagnostics.reasoningEffort !== 'none' ||
      diagnostics.reasoningEnabled !== false
    ) {
      throw new Error('E2E default reasoning-disabled diagnostics are inconsistent.');
    }
    return;
  }

  if (
    diagnostics.reasoningRequestedEffort !== 'medium' ||
    diagnostics.reasoningEffectiveEffort !== 'medium' ||
    diagnostics.reasoningEffort !== 'medium' ||
    diagnostics.reasoningEnabled !== true ||
    diagnostics.reasoningFallbackUsed
  ) {
    throw new Error('E2E thinking-enabled diagnostics are inconsistent.');
  }
}

function isRendererCheckSummary(value: unknown): value is RendererCheckSummary {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<RendererCheckSummary>;
  return (
    typeof candidate.check === 'string' &&
    typeof candidate.success === 'boolean' &&
    typeof candidate.correctionCount === 'number' &&
    typeof candidate.referenceRewriteCount === 'number' &&
    typeof candidate.rewritePracticeCount === 'number' &&
    typeof candidate.reviewRun === 'object'
  );
}

function parseCdpMessage(data: string): CdpResponse | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as CdpResponse) : null;
  } catch {
    return null;
  }
}

function summarizeRuntimeException(exceptionDetails: unknown): string {
  if (typeof exceptionDetails !== 'object' || exceptionDetails === null) {
    return 'Unknown renderer exception.';
  }

  const details = exceptionDetails as {
    text?: unknown;
    exception?: { description?: unknown; value?: unknown };
  };
  const message =
    stringValue(details.exception?.value) ?? stringValue(details.exception?.description) ?? stringValue(details.text);

  return message
    ? message.slice(0, 500).replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-api-key]')
    : 'Unknown renderer exception.';
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function loadDotEnvFile(dotEnvPath: string): void {
  if (!existsSync(dotEnvPath)) {
    return;
  }

  const contents = readFileSync(dotEnvPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseDotEnvLine(line);
    if (!parsed || process.env[parsed.key] !== undefined) {
      continue;
    }
    process.env[parsed.key] = parsed.value;
  }
}

function parseDotEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const withoutExport = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
  const separatorIndex = withoutExport.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }

  const key = withoutExport.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  return {
    key,
    value: unquoteEnvValue(withoutExport.slice(separatorIndex + 1).trim()),
  };
}

function unquoteEnvValue(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const quote = value[0];
  const last = value[value.length - 1];
  if ((quote === '"' || quote === "'") && last === quote) {
    return value.slice(1, -1);
  }

  return value;
}

function envValue(name: string): string | null {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function booleanEnvValue(name: string): boolean {
  const value = envValue(name);
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'E2E review provider check failed.';
  }

  return error.message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-api-key]');
}

export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function sanitizeLogText(text: string, config: E2EConfig): string {
  return text
    .split(config.apiKey)
    .join('[redacted-api-key]')
    .replace(/Authorization:\s*Bearer\s+[^\s]+/gi, 'Authorization: Bearer [redacted]');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entrypoint).href;
}
