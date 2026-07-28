import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_API_ORIGIN, E2E_BASE_URL, E2E_HEALTH_URL, VIEWPORTS } from '../harness/env.mjs';
import {
  apiRequest,
  createDisposableCustomer,
  getCatalogSnapshot,
  originRequest,
} from '../harness/api-client.mjs';
import {
  assertCartDrawerLayout,
  assertDishDetailModalLayout,
  assertMenuMobileFiltersAndBookHeader,
  assertNoHorizontalOverflow,
  assertSakuraBadgeClean,
  closeBrowser,
  gotoRoute,
  withPage,
} from '../harness/browser.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CUSTOMER_WEB_SRC = path.resolve(__dirname, '../../../src');

after(async () => {
  await closeBrowser();
});

describe('Tier 1 — F16: UI & Responsive Polish (Desktop & iPhone)', () => {
  it('T1-F16-01: CartDrawer Thumbnail & Layout Geometry passes on 1280x800 and 375x812', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1601' });
    try {
      const snap = await getCatalogSnapshot();
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
      });
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: snap.dishes[1].dishId, quantity: 2, modifierOptionIds: [] },
      });

      for (const vp of [VIEWPORTS.DESKTOP_1280, VIEWPORTS.IPHONE_375]) {
        await withPage({ viewport: vp, authSession: disp }, async (page) => {
          await gotoRoute(page, '/menu');
          await page.getByRole('button', { name: /Giỏ hàng 3 món/i }).first().click();
          await assertCartDrawerLayout(page, vp);
        });
      }
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F16-02: DishDetailModal Unclipped Header & Footer passes on 1280x800 and 375x812', async () => {
    for (const vp of [VIEWPORTS.DESKTOP_1280, VIEWPORTS.IPHONE_375]) {
      await withPage({ viewport: vp }, async (page) => {
        await gotoRoute(page, '/menu');
        await page.getByPlaceholder(/Tìm theo tên món/i).fill('WAGYU-01');
        await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();
        await assertDishDetailModalLayout(page, vp);
      });
    }
  });

  it('T1-F16-03: Navbar Sakura Badge has zero pulsing red dot across Desktop & iPhone viewports', async () => {
    for (const vp of [VIEWPORTS.DESKTOP_1280, VIEWPORTS.DESKTOP_1440, VIEWPORTS.IPHONE_375, VIEWPORTS.IPHONE_390]) {
      await withPage({ viewport: vp }, async (page) => {
        await gotoRoute(page, '/');
        await assertSakuraBadgeClean(page);
      });
    }
  });

  it('T1-F16-04: MenuPage Mobile Filters & 3D Header fit cleanly on 375x812 & 390x844', async () => {
    for (const vp of [VIEWPORTS.IPHONE_375, VIEWPORTS.IPHONE_390]) {
      await withPage({ viewport: vp }, async (page) => {
        await gotoRoute(page, '/menu');
        await assertMenuMobileFiltersAndBookHeader(page, vp.width);
        await assertNoHorizontalOverflow(page, `/menu @ ${vp.width}`);
      });
    }
  });

  it('T1-F16-05: All Public & Auth Pages are overflow-free across Desktop & iPhone viewports', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1605' });
    try {
      const snap = await getCatalogSnapshot();
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
      });

      const publicRoutes = ['/', '/menu', '/reservation', '/location', '/about', '/blog'];
      for (const vp of [VIEWPORTS.DESKTOP_1280, VIEWPORTS.IPHONE_375]) {
        await withPage({ viewport: vp }, async (page) => {
          for (const r of publicRoutes) {
            await gotoRoute(page, r);
            await assertNoHorizontalOverflow(page, `${r} @ ${vp.width}x${vp.height}`);
          }
        });
      }

      for (const vp of [VIEWPORTS.DESKTOP_1440, VIEWPORTS.IPHONE_390]) {
        await withPage({ viewport: vp, authSession: disp }, async (page) => {
          for (const r of ['/cart', '/checkout']) {
            await gotoRoute(page, r);
            await assertNoHorizontalOverflow(page, `${r} @ ${vp.width}x${vp.height}`);
          }
        });
      }
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 1 — F17: Production Readiness & Configuration', () => {
  it('T1-F17-01: API Health Endpoint GET /health returns 200 OK', async () => {
    const res = await originRequest(E2E_HEALTH_URL);
    assert.equal(res.status, 200, `Expected 200 on ${E2E_HEALTH_URL}, got ${res.status}: ${res.text}`);
  });

  it('T1-F17-02: CORS Allowed Origin Header echoes http://localhost:5173', async () => {
    const res = await fetch(`${E2E_API_ORIGIN}/api/menu/categories`, {
      method: 'GET',
      headers: { Origin: E2E_BASE_URL },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), E2E_BASE_URL);
  });

  it('T1-F17-03: OWASP Security Headers present on API responses', async () => {
    const res = await apiRequest('/menu/categories');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('referrer-policy'), 'Missing Referrer-Policy header');
    assert.ok(res.headers.get('content-security-policy'), 'Missing Content-Security-Policy header');
  });

  it('T1-F17-04: SPA Direct Deep-Link & Reload Resilience serves index.html across routes', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      for (const route of ['/menu', '/reservation', '/location', '/about', '/blog']) {
        await gotoRoute(page, route);
        await page.reload({ waitUntil: 'networkidle' });
        assert.ok(page.url().includes(route), `Reload lost route ${route}`);
        const headingCount = await page.locator('h1').count();
        assert.ok(headingCount >= 1, `Expected rendered <h1> after reloading ${route}`);
      }
    });
  });

  it('T1-F17-05: Image Fallback & Error Resilience handles failed image URLs without broken icons or crash', async () => {
    await withPage(
      {
        viewport: VIEWPORTS.DESKTOP_1280,
        allowedStatuses: ({ status, url }) => status === 404 && url.includes('images.unsplash.com'),
        ignoreRequestFailures: (req) => req.url().includes('images.unsplash.com'),
      },
      async (page) => {
        await page.route('**/*unsplash.com/**', (route) =>
          route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' })
        );
        await gotoRoute(page, '/menu');
        await page.getByRole('heading', { name: 'Tuyển Tập Ẩm Thực Cố Đô' }).waitFor({ state: 'visible' });

        // Verify imgs either swapped to valid fallback (naturalWidth > 0) or handled onError cleanly without pageerror
        const brokenCount = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('main img'));
          return imgs.filter((img) => img.offsetWidth > 0 && (!img.complete || img.naturalWidth === 0)).length;
        });
        assert.equal(brokenCount, 0, 'Images should recover via onError fallback when remote image returns 404');
      }
    );
  });
});

describe('Tier 1 — F18: Opaque-Box E2E Suite & Adversarial Hardening', () => {
  it('T1-F18-01: Live Browser + API Runner Execution verifies live API + Vite integration', async () => {
    const apiRes = await apiRequest('/menu/categories');
    assert.equal(apiRes.status, 200);
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/');
      await page.getByRole('heading', { name: /Nghệ Thuật Ẩm Thực/i }).waitFor({ state: 'visible' });
    });
  });

  it('T1-F18-02: Desktop & iPhone Multi-Viewport Coverage executes interactive navigation on both', async () => {
    for (const vp of [VIEWPORTS.DESKTOP_1440, VIEWPORTS.IPHONE_375]) {
      await withPage({ viewport: vp }, async (page) => {
        await gotoRoute(page, '/');
        await assertNoHorizontalOverflow(page, `T1-F18-02 ${vp.width}`);
      });
    }
  });

  it('T1-F18-03: Console, PageError & Network Hygiene Listener captures zero errors on full tour', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page, telemetry) => {
      for (const route of ['/', '/menu', '/reservation', '/location', '/about', '/blog']) {
        await gotoRoute(page, route);
      }
      assert.equal(telemetry.consoleErrors.length, 0);
      assert.equal(telemetry.pageErrors.length, 0);
      assert.equal(telemetry.badResponses.length, 0);
    });
  });

  it('T1-F18-04: Clean Data Isolation / Cleanup removes disposable customer & SQL artifacts', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1804' });
    const snap = await getCatalogSnapshot();
    await apiRequest('/cart/items', {
      method: 'POST',
      token: disp.accessToken,
      body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
    });
    disp.cleanup();

    const checkLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { phoneNumber: disp.email, email: disp.email, password: disp.password },
    });
    assert.equal(checkLogin.status, 400, 'Cleaned-up disposable user must no longer exist');
  });

  it('T1-F18-05: Zero Mock Reference Gate confirms customer-web/src contains zero mockData or VIP demo bypass', async () => {
    const mockDataPath = path.join(CUSTOMER_WEB_SRC, 'data', 'mockData.ts');
    assert.equal(fs.existsSync(mockDataPath), false, 'src/data/mockData.ts must be deleted');

    const forbiddenPatterns = ['mockData', 'mockDishes', 'mockUsers', 'Demo Khách VIP'];
    const hits = [];

    function scanDir(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf8');
          for (const pat of forbiddenPatterns) {
            if (content.includes(pat)) {
              hits.push(`${path.relative(CUSTOMER_WEB_SRC, full)}: "${pat}"`);
            }
          }
        }
      }
    }

    scanDir(CUSTOMER_WEB_SRC);
    assert.deepEqual(hits, [], `Forbidden mock references found in customer-web/src: ${hits.join(', ')}`);
  });
});
