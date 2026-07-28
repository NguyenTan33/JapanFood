import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { E2E_BASE_URL, E2E_BROWSER_CHANNEL, E2E_HEADLESS, VIEWPORTS } from './env.mjs';

let cachedPlaywright = null;
let sharedBrowser = null;

async function loadPlaywrightCore() {
  if (cachedPlaywright) return cachedPlaywright;

  try {
    cachedPlaywright = await import('playwright-core');
    return cachedPlaywright;
  } catch {
    // Fallback to npm npx cache if playwright-core is not yet linked in node_modules
    const localAppData = process.env.LOCALAPPDATA || '';
    const npxDir = path.join(localAppData, 'npm-cache', '_npx');
    if (fs.existsSync(npxDir)) {
      const subdirs = fs.readdirSync(npxDir);
      for (const sub of subdirs) {
        const candidate = path.join(npxDir, sub, 'node_modules', 'playwright-core', 'index.mjs');
        if (fs.existsSync(candidate)) {
          cachedPlaywright = await import(pathToFileURL(candidate).href);
          return cachedPlaywright;
        }
      }
    }
    throw new Error('playwright-core could not be resolved from node_modules or npm-cache/_npx');
  }
}

export async function getBrowser() {
  if (sharedBrowser && sharedBrowser.isConnected()) return sharedBrowser;
  const { chromium } = await loadPlaywrightCore();

  const channelsToTry = Array.from(new Set([E2E_BROWSER_CHANNEL, 'msedge', 'chrome', undefined]));
  let lastError = null;
  for (const channel of channelsToTry) {
    try {
      sharedBrowser = await chromium.launch({
        headless: E2E_HEADLESS,
        ...(channel ? { channel } : {}),
        args: ['--disable-gpu', '--no-sandbox'],
      });
      return sharedBrowser;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Failed to launch headless Chromium/Edge/Chrome');
}

export async function closeBrowser() {
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch {
      // Ignore close error
    }
    sharedBrowser = null;
  }
}

export async function injectAuthSession(page, authPayload) {
  const accessToken = authPayload?.accessToken || '';
  const refreshToken = authPayload?.refreshToken || '';
  await page.addInitScript(
    ({ at, rt }) => {
      if (at) window.localStorage.setItem('torisakura_access_token', at);
      if (rt) window.localStorage.setItem('torisakura_refresh_token', rt);
    },
    { at: accessToken, rt: refreshToken }
  );
}

function isStatusAllowed(allowedStatuses, status, url, method) {
  if (!allowedStatuses) return false;
  if (allowedStatuses === 'any') return true;
  if (typeof allowedStatuses === 'function') {
    return Boolean(allowedStatuses({ status, url, method }));
  }
  if (Array.isArray(allowedStatuses)) {
    return allowedStatuses.includes(status);
  }
  return false;
}

export async function withPage(optionsOrFn, maybeFn) {
  const options = typeof optionsOrFn === 'function' ? {} : (optionsOrFn || {});
  const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn;

  const viewport = options.viewport || VIEWPORTS.DESKTOP_1280;
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: Boolean(viewport.isMobile),
    hasTouch: Boolean(viewport.hasTouch),
    ...(viewport.deviceScaleFactor ? { deviceScaleFactor: viewport.deviceScaleFactor } : {}),
    locale: 'vi-VN',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(options.timeoutMs || 15000);

  if (options.authSession) {
    await injectAuthSession(page, options.authSession);
  }

  const telemetry = {
    consoleErrors: [],
    pageErrors: [],
    requestFailed: [],
    badResponses: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      telemetry.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    telemetry.pageErrors.push(err?.message || String(err));
  });

  page.on('requestfailed', (req) => {
    const errText = req.failure()?.errorText || 'failed';
    if (errText === 'net::ERR_ABORTED') return;
    if (typeof options.ignoreRequestFailures === 'function' && options.ignoreRequestFailures(req)) {
      return;
    }
    telemetry.requestFailed.push(`${req.method()} ${req.url()} (${errText})`);
  });

  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400) {
      const req = res.request();
      const url = res.url();
      const method = req.method();
      if (!isStatusAllowed(options.allowedStatuses, status, url, method)) {
        telemetry.badResponses.push(`${status} ${method} ${url}`);
      }
    }
  });

  try {
    await fn(page, telemetry);
    if (!options.skipTelemetryAssertions) {
      assert.deepEqual(
        telemetry.pageErrors,
        [],
        `Uncaught pageerrors detected: ${telemetry.pageErrors.join(' | ')}`
      );
      assert.deepEqual(
        telemetry.consoleErrors,
        [],
        `Console errors detected: ${telemetry.consoleErrors.join(' | ')}`
      );
      assert.deepEqual(
        telemetry.requestFailed,
        [],
        `Failed network requests detected: ${telemetry.requestFailed.join(' | ')}`
      );
      assert.deepEqual(
        telemetry.badResponses,
        [],
        `Unexpected HTTP >=400 responses detected: ${telemetry.badResponses.join(' | ')}`
      );
    }
  } finally {
    await context.close();
  }
}

export async function gotoRoute(page, routePath = '/') {
  const target = routePath.startsWith('http')
    ? routePath
    : `${E2E_BASE_URL}${routePath.startsWith('/') ? '' : '/'}${routePath}`;
  await page.goto(target, { waitUntil: 'networkidle' });
}

export async function assertNoHorizontalOverflow(page, contextLabel = '') {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(
    metrics.scrollWidth <= metrics.clientWidth + 1,
    `Horizontal overflow detected ${contextLabel ? `(${contextLabel})` : ''}: scrollWidth=${metrics.scrollWidth} > clientWidth=${metrics.clientWidth}`
  );
}

export async function assertSakuraBadgeClean(page) {
  const headerBrand = page.locator('header a[href="/"]').first();
  await headerBrand.waitFor({ state: 'visible' });

  const violations = await headerBrand.evaluate((anchor) => {
    const issues = [];
    const descendants = anchor.querySelectorAll('*');
    for (const el of descendants) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.animationName && style.animationName !== 'none') {
        issues.push(`animated descendant: ${el.tagName} (${style.animationName})`);
      }
      const isSmallCircle =
        rect.width > 0 &&
        rect.width <= 14 &&
        rect.height > 0 &&
        rect.height <= 14 &&
        (style.borderRadius === '9999px' || style.borderRadius === '50%');
      if (isSmallCircle && style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        const match = style.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const [, r, g, b] = match.map(Number);
          if (r > 120 && g < 80 && b < 80) {
            issues.push(`red dot descendant: ${rect.width}x${rect.height} ${style.backgroundColor}`);
          }
        }
      }
    }
    return issues;
  });

  assert.deepEqual(violations, [], `Sakura logo badge must have zero pulsing red dots: ${violations.join(', ')}`);
}

export async function assertCartDrawerLayout(page, viewport) {
  const vp = viewport || page.viewportSize() || { width: 1280, height: 800 };
  const heading = page.getByRole('heading', { name: 'Giỏ Hàng Của Bạn' });
  await heading.waitFor({ state: 'visible' });

  // Drawer root panel is the fixed right-side panel ancestor of the heading
  const drawerHandle = await heading.evaluateHandle((el) => {
    let cur = el;
    while (cur && cur.parentElement) {
      const style = window.getComputedStyle(cur);
      if (style.display === 'flex' && style.flexDirection === 'column' && cur.getBoundingClientRect().height > 300) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return document.body;
  });

  const audit = await drawerHandle.evaluate((drawer, vpSize) => {
    const drawerRect = drawer.getBoundingClientRect();
    const errors = [];

    if (drawerRect.left < -1 || drawerRect.right > vpSize.width + 1) {
      errors.push(`Drawer outside viewport: left=${drawerRect.left}, right=${drawerRect.right}, vp=${vpSize.width}`);
    }

    const imgs = drawer.querySelectorAll('img');
    for (const img of imgs) {
      const r = img.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.width > 96 || r.height > 96) {
        errors.push(`Invalid CartDrawer thumbnail size (${img.alt}): ${r.width}x${r.height}`);
      }
    }

    const scrollables = Array.from(drawer.querySelectorAll('div')).filter((d) => {
      const s = window.getComputedStyle(d);
      return s.overflowY === 'auto' || s.overflowY === 'scroll';
    });
    for (const sc of scrollables) {
      if (sc.scrollWidth > sc.clientWidth + 1) {
        errors.push(`CartDrawer scroll container overflows horizontally: scrollWidth=${sc.scrollWidth} > clientWidth=${sc.clientWidth}`);
      }
    }

    const deleteBtns = drawer.querySelectorAll('button[title="Xóa món"], button[aria-label*="Xóa"]');
    for (const btn of deleteBtns) {
      const r = btn.getBoundingClientRect();
      if (r.width > 0 && r.right > drawerRect.right + 1) {
        errors.push(`Delete button clipped on right: btn.right=${r.right} > drawer.right=${drawerRect.right}`);
      }
    }

    const priceSpans = Array.from(drawer.querySelectorAll('span')).filter((s) => /₫$/.test((s.innerText || '').trim()));
    for (const sp of priceSpans) {
      const r = sp.getBoundingClientRect();
      const txt = sp.innerText.trim();
      if (!txt.endsWith('₫')) {
        errors.push(`Truncated price text: "${txt}"`);
      }
      if (r.width > 0 && r.right > drawerRect.right + 1) {
        errors.push(`Price "${txt}" extends past drawer right edge: ${r.right} > ${drawerRect.right}`);
      }
    }

    return errors;
  }, vp);

  assert.deepEqual(audit, [], `CartDrawer layout violations: ${audit.join('; ')}`);

  for (const ctaLabel of ['Xem Giỏ Hàng', 'Đặt Hàng Ngay']) {
    const cta = page.getByRole('link', { name: new RegExp(ctaLabel, 'i') }).first();
    if (await cta.isVisible().catch(() => false)) {
      const box = await cta.boundingBox();
      assert.ok(box && box.width > 0 && box.height > 0, `CTA "${ctaLabel}" missing bounding box`);
      assert.ok(box.y + box.height <= vp.height + 1, `CTA "${ctaLabel}" clipped below viewport: ${box.y + box.height} > ${vp.height}`);
    }
  }
}

export async function assertDishDetailModalLayout(page, viewport) {
  const vp = viewport || page.viewportSize() || { width: 1280, height: 800 };
  const addBtn = page.getByRole('button', { name: /Thêm Vào Giỏ Hàng|Đã thêm thành công!/i }).first();
  await addBtn.waitFor({ state: 'visible' });

  const addBox = await addBtn.boundingBox();
  assert.ok(addBox && addBox.width > 0 && addBox.height > 0, 'DishDetailModal CTA missing boundingBox');
  assert.ok(addBox.y >= 0, `DishDetailModal CTA top < 0: ${addBox.y}`);
  assert.ok(
    addBox.y + addBox.height <= vp.height + 1,
    `DishDetailModal CTA clipped at bottom: ${addBox.y + addBox.height} > ${vp.height}`
  );

  // Check modal card and close button geometry
  const modalAudit = await addBtn.evaluate((btn, vpSize) => {
    let modalCard = btn.parentElement;
    while (modalCard && modalCard.parentElement) {
      const r = modalCard.getBoundingClientRect();
      if (r.height > 260 && r.width > 260 && modalCard.querySelector('img')) {
        break;
      }
      modalCard = modalCard.parentElement;
    }
    const cardRect = modalCard.getBoundingClientRect();
    const issues = [];
    if (cardRect.top < -1 || cardRect.bottom > vpSize.height + 1) {
      issues.push(`Modal card outside vertical viewport: top=${cardRect.top}, bottom=${cardRect.bottom}, vp=${vpSize.height}`);
    }
    const closeBtn =
      modalCard.querySelector('button[aria-label*="Đóng"], button[aria-label*="Close"]') ||
      modalCard.querySelector('button');
    if (closeBtn) {
      const cr = closeBtn.getBoundingClientRect();
      if (cr.top < -1 || cr.right > vpSize.width + 1) {
        issues.push(`Close button clipped: top=${cr.top}, right=${cr.right}, vpWidth=${vpSize.width}`);
      }
    }
    return issues;
  }, vp);

  assert.deepEqual(modalAudit, [], `DishDetailModal geometry violations: ${modalAudit.join('; ')}`);
}

export async function assertMenuMobileFiltersAndBookHeader(page, viewportWidth = 375) {
  const labels = ['Tất cả giá', 'Dưới 200.000₫', '200.000₫ - 500.000₫', 'Trên 500.000₫ (Cao cấp)'];
  const boxes = [];
  for (const label of labels) {
    const btn = page.getByRole('button', { name: label, exact: true }).first();
    await btn.waitFor({ state: 'visible' });
    const box = await btn.boundingBox();
    assert.ok(box, `Missing boundingBox for price filter "${label}"`);
    assert.ok(box.height <= 44, `Price filter "${label}" wrapped/squeezed too tall: height=${box.height} > 44`);
    assert.ok(box.x + box.width <= viewportWidth + 1, `Price filter "${label}" overflows viewport width: ${box.x + box.width}`);
    boxes.push({ label, box });
  }

  // Verify zero bounding-box overlap between price pills
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].box;
      const b = boxes[j].box;
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      assert.ok(
        overlapX <= 1 || overlapY <= 1,
        `Price filter pills "${boxes[i].label}" and "${boxes[j].label}" overlap`
      );
    }
  }

  // Book header page badge
  const pageBadge = page.getByText(/^Trang \d+ \/ \d+$/).first();
  if (await pageBadge.isVisible().catch(() => false)) {
    const badgeBox = await pageBadge.boundingBox();
    assert.ok(badgeBox, 'Missing boundingBox for "Trang X / Y" badge');
    assert.ok(badgeBox.height <= 36, `"Trang X / Y" badge wrapped multi-line: height=${badgeBox.height} > 36`);
    assert.ok(badgeBox.x + badgeBox.width <= viewportWidth + 1, `"Trang X / Y" overflows right edge`);
  }
}

export async function assertImagesLoaded(page, rootSelector = 'main') {
  const broken = await page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    const imgs = Array.from(root.querySelectorAll('img'));
    return imgs
      .filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (!img.complete || img.naturalWidth === 0);
      })
      .map((img) => ({ alt: img.alt, src: img.src }));
  }, rootSelector);

  assert.deepEqual(broken, [], `Broken images detected: ${JSON.stringify(broken)}`);
}
