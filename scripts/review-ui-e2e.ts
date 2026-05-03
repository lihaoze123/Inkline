import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { pathToFileURL } from 'node:url';
import {
  bestEffortCloseBrowser,
  buildNativeDependencyLdLibraryPath,
  captureCdpProcessIds,
  CdpClient,
  cleanupElectronSession,
  errorName,
  getFreePort,
  safeErrorMessage,
  sleep,
  type ElectronSession,
  waitForRendererApi,
  waitForRendererTarget,
} from './review-provider-e2e';
import {
  E2E_UI_REWRITE_PRACTICE_ANSWER,
  E2E_UI_SAMPLE_GOAL,
  E2E_UI_SAMPLE_WRITING,
  E2E_UI_SELF_REPAIR_REWRITE,
} from '../test/fixtures/review-ui-e2e';

const KEYCHAIN_SERVICE_ENV = 'INKLINE_KEYCHAIN_SERVICE_NAME';
const E2E_AI_MOCK_ENV = 'INKLINE_E2E_AI_MOCK';
const E2E_REWRITE_DUE_NOW_ENV = 'INKLINE_E2E_REWRITE_DUE_NOW';
const E2E_USER_DATA_ENV = 'INKLINE_E2E_USER_DATA_DIR';
const ARTIFACT_DIR = path.resolve(process.cwd(), 'test-results', 'review-ui-e2e');
const FAILURE_SCREENSHOT_PATH = path.join(ARTIFACT_DIR, 'failure.png');
const MOCK_BASE_URL = 'https://mock.invalid/v1';
const MOCK_MODEL = 'inkline-e2e-mock-model';
const MOCK_API_KEY = 'e2e-mock-api-key';
const CDP_WAIT_TIMEOUT_MS = 120_000;
const REVIEW_TIMEOUT_MS = 180_000;
const REWRITE_CHECK_TIMEOUT_MS = 120_000;

type UiE2EPhase =
  | 'setup'
  | 'launch-cdp'
  | 'renderer-api-readiness'
  | 'app-entry-provider-setup'
  | 'review-generation'
  | 'feedback-save'
  | 'rewrite-practice'
  | 'diagnostics'
  | 'cleanup';

type DomActionResult = {
  success: boolean;
  error?: string;
};

type DomSummary = {
  title: string;
  url: string;
  text: string;
  headings: string[];
  buttons: string[];
  e2eElements: string[];
};

class E2EPhaseError extends Error {
  constructor(
    readonly phase: UiE2EPhase,
    cause: unknown,
  ) {
    super(sanitizeE2eFailureText(safeErrorMessage(cause)));
    this.name = 'E2EPhaseError';
  }
}

if (isMainModule()) {
  main().catch((error: unknown) => {
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          phase: error instanceof E2EPhaseError ? error.phase : 'setup',
          errorName: errorName(error),
          errorMessage: sanitizeE2eFailureText(safeErrorMessage(error)),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  });
}

async function main(): Promise<void> {
  let currentPhase: UiE2EPhase = 'setup';
  let session: ElectronSession | null = null;
  let cdp: CdpClient | null = null;
  let failure: unknown = null;

  const runPhase = async <Result>(phase: UiE2EPhase, action: () => Promise<Result>): Promise<Result> => {
    currentPhase = phase;
    const startedAt = Date.now();
    console.log(JSON.stringify({ phase, status: 'started' }));

    try {
      const result = await action();
      console.log(JSON.stringify({ phase, status: 'completed', durationMs: Date.now() - startedAt }));
      return result;
    } catch (error) {
      throw new E2EPhaseError(phase, error);
    }
  };

  try {
    await runPhase('setup', async () => {
      await mkdir(ARTIFACT_DIR, { recursive: true });
    });

    const cdpPort = await getFreePort();
    session = await runPhase('launch-cdp', async () => {
      const launchedSession = await launchMockElectronSession(cdpPort);
      session = launchedSession;
      const target = await waitForRendererTarget(launchedSession.cdpPort, launchedSession.recentOutput);
      cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
      await cdp.send('Runtime.enable');
      await cdp.send('Page.enable');
      await captureCdpProcessIds(cdp, launchedSession);
      return launchedSession;
    });

    if (!cdp) {
      throw new Error('CDP connection was not created.');
    }

    await runPhase('renderer-api-readiness', async () => {
      if (!cdp) {
        throw new Error('CDP connection was not created.');
      }
      await waitForRendererApi(cdp);
    });

    const driver = new DomDriver(cdp);

    await runPhase('app-entry-provider-setup', async () => {
      await dismissOnboarding(driver);
      await configureMockProvider(driver);
    });

    await runPhase('review-generation', async () => {
      await enterWritingAndStartReview(driver);
    });

    await runPhase('feedback-save', async () => {
      await saveFocusedFeedback(driver);
    });

    await runPhase('rewrite-practice', async () => {
      await completeRewritePractice(driver);
    });

    console.log(
      JSON.stringify(
        {
          status: 'passed',
          phases: [
            'setup',
            'launch-cdp',
            'renderer-api-readiness',
            'app-entry-provider-setup',
            'review-generation',
            'feedback-save',
            'rewrite-practice',
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    failure = error;
    const phase = error instanceof E2EPhaseError ? error.phase : currentPhase;
    const diagnostics = cdp ? await captureFailureDiagnostics(cdp) : null;
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          phase,
          errorName: errorName(error),
          errorMessage: sanitizeE2eFailureText(safeErrorMessage(error)),
          diagnostics,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    currentPhase = 'cleanup';
    try {
      const activeCdp = activeCdpClient(cdp);
      if (activeCdp) {
        await bestEffortCloseBrowser(activeCdp);
        activeCdp.close();
      }
      const activeSession = activeElectronSession(session);
      if (activeSession) {
        await cleanupElectronSession(activeSession);
      }
      console.log(JSON.stringify({ phase: 'cleanup', status: 'completed' }));
    } catch (cleanupError) {
      console.error(
        JSON.stringify(
          {
            status: 'failed',
            phase: 'cleanup',
            errorName: errorName(cleanupError),
            errorMessage: sanitizeE2eFailureText(safeErrorMessage(cleanupError)),
          },
          null,
          2,
        ),
      );
      if (!failure) {
        process.exitCode = 1;
      }
    }
  }
}

async function launchMockElectronSession(cdpPort: number): Promise<ElectronSession> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'Inkline-ui-e2e-'));
  const xdgConfigHome = path.join(tempRoot, 'xdg-config');
  const userDataRoot = path.join(tempRoot, 'user-data');
  const keychainServiceName = `Inkline-ui-e2e-${randomUUID()}`;
  const outputLines: string[] = [];
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    XDG_CONFIG_HOME: xdgConfigHome,
    [E2E_USER_DATA_ENV]: userDataRoot,
    [KEYCHAIN_SERVICE_ENV]: keychainServiceName,
    [E2E_AI_MOCK_ENV]: '1',
    [E2E_REWRITE_DUE_NOW_ENV]: '1',
  };
  const nativeDependencyLdLibraryPath = buildNativeDependencyLdLibraryPath({
    currentLdLibraryPath: process.env.LD_LIBRARY_PATH,
  });
  if (nativeDependencyLdLibraryPath) {
    childEnv.LD_LIBRARY_PATH = nativeDependencyLdLibraryPath;
  }

  const electronArgs = [
    `--remote-debugging-port=${cdpPort}`,
    '--disable-gpu',
    '--window-size=1280,900',
    '--force-prefers-reduced-motion=reduce',
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
  ];
  const child = spawn('pnpm', ['exec', 'electron-forge', 'start', '--', ...electronArgs], {
    cwd: process.cwd(),
    env: childEnv,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const recordOutput = (chunk: Buffer): void => {
    for (const line of sanitizeE2eFailureText(chunk.toString('utf8')).split(/\r?\n/)) {
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

async function dismissOnboarding(driver: DomDriver): Promise<void> {
  if (await driver.isE2eVisible('onboarding-continue', 3_000)) {
    await driver.clickE2e('onboarding-continue');
  } else if (!(await driver.isE2eVisible('onboarding-next', 7_000))) {
    return;
  }

  for (let index = 0; index < 3; index += 1) {
    if (await driver.isE2eVisible('onboarding-enter')) {
      await driver.clickE2e('onboarding-enter');
      await driver.waitUntilE2eHidden('onboarding-enter', CDP_WAIT_TIMEOUT_MS);
      return;
    }

    await driver.clickE2e('onboarding-next');
  }

  if (await driver.isE2eVisible('onboarding-enter')) {
    await driver.clickE2e('onboarding-enter');
    await driver.waitUntilE2eHidden('onboarding-enter', CDP_WAIT_TIMEOUT_MS);
  }
}

async function configureMockProvider(driver: DomDriver): Promise<void> {
  await driver.clickE2e('nav-settings');
  await driver.waitForE2e('openai-base-url-input');
  await driver.selectE2e('default-provider-select', 'openai-compatible');
  await driver.fillE2e('openai-base-url-input', MOCK_BASE_URL);
  await driver.fillE2e('openai-model-input', MOCK_MODEL);
  await driver.clickE2e('openai-compatible-save-settings');
  await driver.waitForText('OpenAI-compatible settings saved.');
  await driver.fillE2e('openai-compatible-api-key-input', MOCK_API_KEY);
  await driver.clickE2e('openai-compatible-save-api-key');
  await driver.waitForText('Provider API key saved to the OS keychain.');
}

async function enterWritingAndStartReview(driver: DomDriver): Promise<void> {
  await driver.clickE2e('nav-write');
  await driver.waitForE2e('writing-editor');
  await driver.clickE2e('starter-goal-summary');
  await driver.fillE2e('writing-goal-input', E2E_UI_SAMPLE_GOAL);
  await driver.fillE2e('writing-editor', E2E_UI_SAMPLE_WRITING);
  await driver.waitForE2e('get-feedback-button');
  await driver.clickE2e('get-feedback-button');

  if (await driver.isE2eVisible('review-disclosure-acknowledge', 8_000)) {
    await driver.clickE2e('review-disclosure-acknowledge');
  }

  await driver.waitForE2e('open-focused-review-button', REVIEW_TIMEOUT_MS);
  await driver.waitForText('Focused review is ready.', REVIEW_TIMEOUT_MS);
}

async function saveFocusedFeedback(driver: DomDriver): Promise<void> {
  await driver.clickE2e('open-focused-review-button');
  await driver.waitForE2e('feedback-page');
  await driver.waitForText('Feedback & Rewrite');
  await driver.waitForText('Original draft');
  await driver.waitForText('Try rewriting');
  await driver.fillE2e('self-repair-rewrite-input', E2E_UI_SELF_REPAIR_REWRITE);
  await driver.clickE2e('save-review-button');
  await driver.waitForText('Review saved', CDP_WAIT_TIMEOUT_MS);
  await driver.clickE2e('feedback-back-to-draft');
}

async function completeRewritePractice(driver: DomDriver): Promise<void> {
  await driver.waitForE2e('rewrite-practice-summary', CDP_WAIT_TIMEOUT_MS);
  await driver.clickE2e('rewrite-practice-summary');
  await driver.waitForE2e('rewrite-practice-card');
  await driver.fillE2e('rewrite-practice-input', E2E_UI_REWRITE_PRACTICE_ANSWER);
  await driver.waitForE2eEnabled('rewrite-practice-submit', CDP_WAIT_TIMEOUT_MS);
  await driver.clickE2e('rewrite-practice-submit');
  await driver.waitForText('Good repair.', REWRITE_CHECK_TIMEOUT_MS);
  await driver.waitForText('Native model:', CDP_WAIT_TIMEOUT_MS);
}

async function captureFailureDiagnostics(cdp: CdpClient): Promise<{
  screenshotPath: string | null;
  domSummary: DomSummary | null;
}> {
  const driver = new DomDriver(cdp);
  let screenshotPath: string | null = null;
  let domSummary: DomSummary | null = null;

  try {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    const screenshot = (await cdp.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: false },
      15_000,
    )) as { result?: { data?: unknown } };
    if (typeof screenshot.result?.data === 'string') {
      await writeFile(FAILURE_SCREENSHOT_PATH, Buffer.from(screenshot.result.data, 'base64'));
      screenshotPath = FAILURE_SCREENSHOT_PATH;
    }
  } catch {
    screenshotPath = null;
  }

  try {
    domSummary = await driver.domSummary();
  } catch {
    domSummary = null;
  }

  return { screenshotPath, domSummary };
}

class DomDriver {
  constructor(private readonly cdp: CdpClient) {}

  async waitForE2e(id: string, timeoutMs = CDP_WAIT_TIMEOUT_MS): Promise<void> {
    const selector = selectorForE2e(id);
    await waitForCondition(`selector ${selector}`, async () => this.isSelectorVisible(selector), timeoutMs);
  }

  async waitForE2eEnabled(id: string, timeoutMs = CDP_WAIT_TIMEOUT_MS): Promise<void> {
    const selector = selectorForE2e(id);
    await waitForCondition(`selector ${selector} enabled`, async () => this.isSelectorEnabled(selector), timeoutMs);
  }

  async waitUntilE2eHidden(id: string, timeoutMs = CDP_WAIT_TIMEOUT_MS): Promise<void> {
    const selector = selectorForE2e(id);
    await waitForCondition(
      `selector ${selector} hidden`,
      async () => !(await this.isSelectorVisible(selector)),
      timeoutMs,
    );
  }

  async isE2eVisible(id: string, timeoutMs = 1_000): Promise<boolean> {
    const selector = selectorForE2e(id);
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (await this.isSelectorVisible(selector)) {
        return true;
      }
      await sleep(100);
    }
    return false;
  }

  async clickE2e(id: string): Promise<void> {
    const selector = selectorForE2e(id);
    await this.waitForE2eEnabled(id);
    const result = await this.evaluateDomAction(
      `(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!(element instanceof HTMLElement)) {
          return { success: false, error: 'Element is not clickable.' };
        }
        const isDisabledControl =
          (element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement) &&
          element.disabled;
        if (isDisabledControl || element.getAttribute('aria-disabled') === 'true') {
          return { success: false, error: 'Element is disabled.' };
        }
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.click();
        return { success: true };
      })()`,
    );
    assertDomAction(result, `click ${selector}`);
  }

  async fillE2e(id: string, value: string): Promise<void> {
    const selector = selectorForE2e(id);
    await this.waitForE2eEnabled(id);
    const result = await this.evaluateDomAction(
      `(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
          return { success: false, error: 'Element is not an input or textarea.' };
        }
        element.focus();
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor?.set) {
          descriptor.set.call(element, ${JSON.stringify(value)});
        } else {
          element.value = ${JSON.stringify(value)};
        }
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      })()`,
    );
    assertDomAction(result, `fill ${selector}`);
  }

  async selectE2e(id: string, value: string): Promise<void> {
    const selector = selectorForE2e(id);
    await this.waitForE2eEnabled(id);
    const result = await this.evaluateDomAction(
      `(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!(element instanceof HTMLSelectElement)) {
          return { success: false, error: 'Element is not a select.' };
        }
        element.value = ${JSON.stringify(value)};
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      })()`,
    );
    assertDomAction(result, `select ${selector}`);
  }

  async waitForText(text: string, timeoutMs = CDP_WAIT_TIMEOUT_MS): Promise<void> {
    await waitForCondition(
      `text "${text}"`,
      async () => {
        const result = await this.cdp.evaluate(
          `document.body?.innerText.includes(${JSON.stringify(text)}) ?? false`,
          10_000,
        );
        return result === true;
      },
      timeoutMs,
    );
  }

  async domSummary(): Promise<DomSummary> {
    const result = await this.cdp.evaluate(
      `(() => {
        const isVisible = (element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
        };
        const clean = (value) => value.replace(/\\s+/g, ' ').trim();
        return {
          title: document.title,
          url: window.location.href,
          text: clean(document.body?.innerText ?? '').slice(0, 1200),
          headings: Array.from(document.querySelectorAll('h1,h2,h3'))
            .filter(isVisible)
            .map((element) => clean(element.textContent ?? ''))
            .filter(Boolean)
            .slice(0, 16),
          buttons: Array.from(document.querySelectorAll('button'))
            .filter(isVisible)
            .map((element) => clean(element.textContent ?? ''))
            .filter(Boolean)
            .slice(0, 24),
          e2eElements: Array.from(document.querySelectorAll('[data-e2e]'))
            .filter(isVisible)
            .map((element) => element.getAttribute('data-e2e') ?? '')
            .filter(Boolean)
            .slice(0, 40),
        };
      })()`,
      10_000,
    );

    return sanitizeDomSummary(result);
  }

  private async isSelectorVisible(selector: string): Promise<boolean> {
    const result = await this.cdp.evaluate(
      `(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
      })()`,
      10_000,
    );
    return result === true;
  }

  private async isSelectorEnabled(selector: string): Promise<boolean> {
    const result = await this.cdp.evaluate(
      `(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const style = window.getComputedStyle(element);
        const isVisible =
          style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
        const isDisabledControl =
          (element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement) &&
          element.disabled;
        return isVisible && !isDisabledControl && element.getAttribute('aria-disabled') !== 'true';
      })()`,
      10_000,
    );
    return result === true;
  }

  private async evaluateDomAction(expression: string): Promise<DomActionResult> {
    const result = await this.cdp.evaluate(expression, 15_000);
    if (typeof result !== 'object' || result === null) {
      return { success: false, error: 'DOM action returned an invalid result.' };
    }

    const candidate = result as Partial<DomActionResult>;
    return { success: candidate.success === true, error: stringOrUndefined(candidate.error) };
  }
}

export function selectorForE2e(id: string): string {
  return `[data-e2e="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

export function sanitizeE2eFailureText(text: string): string {
  return text
    .split(MOCK_API_KEY)
    .join('[redacted-api-key]')
    .replace(/\b((?:sk|sk-ant|sk-proj|rk|pk)-)[A-Za-z0-9_-]{8,}\b/gi, '$1[REDACTED]')
    .replace(/\b(authorization\s*[:=]\s*bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/\b(api[_-]?key|access_token|token|key)=([^&\s]+)/gi, '$1=[REDACTED]')
    .slice(0, 2_000);
}

async function waitForCondition(label: string, condition: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return;
    }
    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

function assertDomAction(result: DomActionResult, label: string): void {
  if (!result.success) {
    throw new Error(`${label} failed: ${result.error ?? 'unknown DOM action error'}`);
  }
}

function sanitizeDomSummary(value: unknown): DomSummary {
  if (typeof value !== 'object' || value === null) {
    return {
      title: '',
      url: '',
      text: '',
      headings: [],
      buttons: [],
      e2eElements: [],
    };
  }

  const candidate = value as Partial<DomSummary>;
  return {
    title: sanitizeE2eFailureText(stringOrUndefined(candidate.title) ?? ''),
    url: sanitizeE2eFailureText(stringOrUndefined(candidate.url) ?? ''),
    text: sanitizeE2eFailureText(stringOrUndefined(candidate.text) ?? ''),
    headings: stringArray(candidate.headings).map(sanitizeE2eFailureText),
    buttons: stringArray(candidate.buttons).map(sanitizeE2eFailureText),
    e2eElements: stringArray(candidate.e2eElements).map(sanitizeE2eFailureText),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function activeCdpClient(client: CdpClient | null): CdpClient | null {
  return client;
}

function activeElectronSession(session: ElectronSession | null): ElectronSession | null {
  return session;
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entrypoint).href;
}
