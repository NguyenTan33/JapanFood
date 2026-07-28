import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BROWSER, PATHS, STORAGE_KEYS, TIMEOUTS, VIEWPORTS, WEB_URL } from './config.mjs';
import { getSession } from './api-client.mjs';

let sharedBrowser = null;
let playwrightModule = null;
let playwrightSource = null;

function findNpxPlaywrightCandidates() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return [];
  const npxRoot = path.join(localAppData, 'npm-cache', '_npx');
  if (!fs.existsSync(npxRoot)) return [];

  const candidates = [];
  try {
    for (const entry of fs.readdirSync(npxRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(npxRoot, entry.name, 'node_modules', 'playwright-core', 'index.mjs');
      if (fs.existsSync(candidate)) candidates.push(candidate);
    }
  } catch {
    return candidates;
  }
  return candidates;
}

export async function resolvePlaywrightSource() {
  if (playwrightSource) return playwrightSource;

  try {
    const resolved = import.meta.resolve('playwright-core');
    playwrightSource = resolved;
    return playwrightSource;
  } catch {
    // Fallback below
  }

  try {
    const resolved = import.meta.resolve('playwright');
    playwrightSource = resolved;
    return playwrightSource;
  } catch {
    // Fallback below
  }

  const siblingPath = path.resolve(PATHS.SUITE_ROOT, '../customer-web/node_modules/playwright-core/index.mjs');
  if (fs.existsSync(siblingPath)) {
    playwrightSource = pathToFileURL(siblingPath).href;
    return playwrightSource;
  }

  for (const npxPath of findNpxPlaywrightCandidates()) {
    playwrightSource = pathToFileURL(npxPath).href;
    return playwrightSource;
  }

  throw new Error(
    'Unable to resolve playwright-core or playwright. Run "npm install" inside e2e-suite/ or customer-web/.',
  );
}

export async function loadPlaywright() {
  if (playwrightModule) return playwrightModule;
  const source = await resolvePlaywrightSource();
  const mod = await import(source);
  playwrightModule = mod.default || mod;
  return playwrightModule;
}

export function ensureArtifactsDir() {
  fs.mkdirSync(PATHS.ARTIFACTS_DIR, { recursive: true });
  fs.mkdirSync(PATHS.SCREENSHOTS_DIR, { recursive: true });
  return PATHS.ARTIFACTS_DIR;
}

function buildLaunchAttempts() {
  const attempts = [];

  if (BROWSER.executablePath && fs.existsSync(BROWSER.executablePath)) {
    attempts.push({ executablePath: BROWSER.executablePath });
  }

  const channels = new Set(
    [process.env.E2E_BROWSER_CHANNEL, 'chrome', 'msedge', BROWSER.channel].filter(Boolean),
  );
  for (const channel of channels) {
    attempts.push({ channel });
  }

  const winExecutables = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const exe of winExecutables) {
    if (fs.existsSync(exe)) {
      attempts.push({ executablePath: exe });
    }
  }

  attempts.push({});
  return attempts;
}

export async function getBrowser() {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }

  const pw = await loadPlaywright();
  const launchArgs = [
    '--disable-gpu',
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
  ];

  const attempts = buildLaunchAttempts();
  const errors = [];

  for (const target of attempts) {
    try {
      sharedBrowser = await pw.chromium.launch({
        headless: BROWSER.headless,
        args: launchArgs,
        ...target,
      });
      return sharedBrowser;
    } catch (err) {
      errors.push(`${JSON.stringify(target)} -> ${err.message}`);
    }
  }

  throw new Error(`Failed to launch Chromium/Chrome/Edge:\n${errors.join('\n')}`);
}

export async function closeBrowser() {
  if (sharedBrowser) {
    const b = sharedBrowser;
    sharedBrowser = null;
    try {
      await b.close();
    } catch {
      // ignore already-closed browser
    }
  }
}

export async function createContext(options = {}) {
  const browser = await getBrowser();
  const viewport = options.viewport || VIEWPORTS.POS_1280;
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: Boolean(viewport.isMobile),
    hasTouch: Boolean(viewport.hasTouch),
    permissions: options.permissions ?? ['camera'],
    locale: options.locale ?? 'vi-VN',
  });

  // Always inject window.print() spy for KDS/POS receipt printing tests
  await context.addInitScript(() => {
    window.__e2ePrintCalls = [];
    window.print = () => {
      window.__e2ePrintCalls.push({
        timestamp: Date.now(),
        iso: new Date().toISOString(),
        url: window.location.href,
        title: document.title,
      });
    };
  });

  if (options.authSession) {
    const session =
      typeof options.authSession === 'string'
        ? await getSession(options.authSession)
        : options.authSession;

    await context.addInitScript(
      ({ keys, sessionData }) => {
        if (sessionData?.accessToken) {
          window.localStorage.setItem(keys.accessToken, sessionData.accessToken);
        }
        if (sessionData?.refreshToken) {
          window.localStorage.setItem(keys.refreshToken, sessionData.refreshToken);
        }
        if (sessionData?.user) {
          window.localStorage.setItem(keys.user, JSON.stringify(sessionData.user));
        }
      },
      { keys: STORAGE_KEYS, sessionData: session },
    );
  }

  return context;
}

export async function newPage(options = {}) {
  const context = await createContext(options);
  const page = await context.newPage();

  page.setDefaultTimeout(options.timeoutMs ?? TIMEOUTS.actionMs);
  page.setDefaultNavigationTimeout(options.navTimeoutMs ?? TIMEOUTS.navMs);

  const telemetry = {
    consoleErrors: [],
    pageErrors: [],
    requestFailed: [],
    serverErrors: [],
    httpErrors: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      telemetry.consoleErrors.push({
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString(),
      });
    }
  });

  page.on('pageerror', (err) => {
    telemetry.pageErrors.push({
      message: err?.message || String(err),
      stack: err?.stack || '',
      timestamp: new Date().toISOString(),
    });
  });

  page.on('requestfailed', (req) => {
    const failureText = req.failure()?.errorText || 'unknown';
    if (failureText === 'net::ERR_ABORTED') return;
    telemetry.requestFailed.push({
      method: req.method(),
      url: req.url(),
      failureText,
      timestamp: new Date().toISOString(),
    });
  });

  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400) {
      const entry = {
        status,
        method: res.request().method(),
        url: res.url(),
        timestamp: new Date().toISOString(),
      };
      telemetry.httpErrors.push(entry);
      if (status >= 500) {
        telemetry.serverErrors.push(entry);
      }
    }
  });

  page.__e2eTelemetry = telemetry;
  page.__e2eContext = context;

  return {
    page,
    context,
    telemetry,
    close: async () => {
      try {
        await context.close();
      } catch {
        // ignore close errors
      }
    },
  };
}

export async function captureScreenshot(page, label = 'screenshot', { fullPage = true } = {}) {
  ensureArtifactsDir();
  const safeLabel = String(label || 'screenshot')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'screenshot';
  const fileName = `${safeLabel}-${Date.now()}.png`;
  const outPath = path.join(PATHS.SCREENSHOTS_DIR, fileName);
  await page.screenshot({ path: outPath, fullPage });
  return outPath;
}

export async function withPage(optionsOrFn, maybeFn) {
  const options = typeof optionsOrFn === 'function' ? {} : optionsOrFn || {};
  const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn;
  if (typeof fn !== 'function') {
    throw new TypeError('withPage requires a callback function');
  }

  const handle = await newPage(options);
  try {
    return await fn(handle);
  } catch (err) {
    try {
      const failLabel = options.screenshotLabel || 'fail-page';
      const shotPath = await captureScreenshot(handle.page, failLabel, { fullPage: true });
      if (err && typeof err === 'object') {
        err.screenshotPath = err.screenshotPath || shotPath;
      }
    } catch {
      // ignore screenshot capture failure if page crashed
    }
    throw err;
  } finally {
    await handle.close();
  }
}

export async function loginInBrowser(page, sessionOrRole = 'ADMIN') {
  const session =
    typeof sessionOrRole === 'string' ? await getSession(sessionOrRole) : sessionOrRole;

  const currentUrl = page.url();
  if (!currentUrl || !currentUrl.startsWith(WEB_URL)) {
    await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' });
  }

  await page.evaluate(
    ({ keys, sessionData }) => {
      if (sessionData?.accessToken) {
        window.localStorage.setItem(keys.accessToken, sessionData.accessToken);
      }
      if (sessionData?.refreshToken) {
        window.localStorage.setItem(keys.refreshToken, sessionData.refreshToken);
      }
      if (sessionData?.user) {
        window.localStorage.setItem(keys.user, JSON.stringify(sessionData.user));
      }
    },
    { keys: STORAGE_KEYS, sessionData: session },
  );

  return session;
}

export async function gotoRoute(page, routePath = '/', { waitUntil = 'domcontentloaded' } = {}) {
  const target = /^https?:\/\//i.test(routePath)
    ? routePath
    : `${WEB_URL}/${String(routePath).replace(/^\/+/, '')}`;
  await page.goto(target, { waitUntil });
  return target;
}

export async function getPrintCalls(page) {
  return page.evaluate(() => (Array.isArray(window.__e2ePrintCalls) ? window.__e2ePrintCalls : []));
}

export async function resetPrintCalls(page) {
  await page.evaluate(() => {
    window.__e2ePrintCalls = [];
  });
}

export async function uploadFile(page, target, fileInput) {
  const payload = fileInput || PATHS.SAMPLE_RECEIPT_PATH;

  if (typeof target === 'string') {
    const loc = page.locator(target).first();
    const tag = await loc.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    const inputType = await loc.evaluate((el) => el.getAttribute('type') || '').catch(() => '');
    if (tag === 'input' && inputType === 'file') {
      await loc.setInputFiles(payload);
      return;
    }
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      loc.click(),
    ]);
    await chooser.setFiles(payload);
    return;
  }

  if (target && typeof target.setInputFiles === 'function') {
    const tag = await target.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    const inputType = await target.evaluate((el) => el.getAttribute('type') || '').catch(() => '');
    if (tag === 'input' && inputType === 'file') {
      await target.setInputFiles(payload);
      return;
    }
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      target.click(),
    ]);
    await chooser.setFiles(payload);
    return;
  }

  throw new TypeError('uploadFile target must be a CSS selector string or Playwright Locator');
}

export default {
  resolvePlaywrightSource,
  loadPlaywright,
  ensureArtifactsDir,
  getBrowser,
  closeBrowser,
  createContext,
  newPage,
  withPage,
  loginInBrowser,
  gotoRoute,
  getPrintCalls,
  resetPrintCalls,
  uploadFile,
  captureScreenshot,
};
