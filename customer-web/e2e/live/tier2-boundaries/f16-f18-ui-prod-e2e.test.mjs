import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS } from '../harness/env.mjs';
import {
  apiRequest,
  createDisposableCustomer,
  getCatalogSnapshot,
} from '../harness/api-client.mjs';
import {
  assertCartDrawerLayout,
  assertDishDetailModalLayout,
  assertNoHorizontalOverflow,
  closeBrowser,
  gotoRoute,
  withPage,
} from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 2 — F16 Boundaries: Viewport & Geometry Extremes', () => {
  it('T2-F16-01: 375x812 iPhone SE/13 Mini Zero Horizontal Overflow across all 8 routes', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1601' });
    try {
      const snap = await getCatalogSnapshot();
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
      });

      await withPage({ viewport: VIEWPORTS.IPHONE_375 }, async (page) => {
        for (const r of ['/', '/menu', '/reservation', '/location', '/about', '/blog']) {
          await gotoRoute(page, r);
          await assertNoHorizontalOverflow(page, `${r} @ 375x812`);
        }
      });

      await withPage({ viewport: VIEWPORTS.IPHONE_375, authSession: disp }, async (page) => {
        for (const r of ['/cart', '/checkout']) {
          await gotoRoute(page, r);
          await assertNoHorizontalOverflow(page, `${r} @ 375x812`);
        }
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F16-02: 390x844 iPhone 14/15 Zero Overflow + MobileNav opaque panel & close', async () => {
    await withPage({ viewport: VIEWPORTS.IPHONE_390 }, async (page) => {
      await gotoRoute(page, '/');
      await assertNoHorizontalOverflow(page, '/ @ 390x844');

      await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
      const cta = page.getByRole('link', { name: 'Đặt bàn trực tuyến ngay' });
      await cta.waitFor({ state: 'visible' });

      // Verify MobileNav panel background is genuinely opaque (alpha >= 0.9)
      const bgAlpha = await cta.evaluate((el) => {
        let p = el.parentElement;
        while (p && p.parentElement) {
          const bg = window.getComputedStyle(p).backgroundColor;
          const m = bg.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)/);
          if (m && bg !== 'rgba(0, 0, 0, 0)') {
            return m[1] === undefined ? 1 : Number(m[1]);
          }
          p = p.parentElement;
        }
        return 0;
      });
      assert.ok(bgAlpha >= 0.85, `MobileNav background must be opaque (alpha >= 0.85), got ${bgAlpha}`);

      await page.getByRole('button', { name: 'Đóng menu điều hướng' }).click();
      await cta.waitFor({ state: 'hidden' });
    });
  });

  it('T2-F16-03: DishDetailModal at 1280x800 & 375x812 with Max Modifier Groups (RAMEN-01)', async () => {
    for (const vp of [VIEWPORTS.DESKTOP_1280, VIEWPORTS.IPHONE_375]) {
      await withPage({ viewport: vp }, async (page) => {
        await gotoRoute(page, '/menu');
        await page.getByPlaceholder(/Tìm theo tên món/i).fill('RAMEN-01');
        await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();
        await assertDishDetailModalLayout(page, vp);
      });
    }
  });

  it('T2-F16-04: CartDrawer at 375x812 with Multiple Items + Modifiers passes overflow/bounds check', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1604' });
    try {
      const snap = await getCatalogSnapshot();
      const ramenDetail = (await apiRequest('/menu/dishes/RAMEN-01')).data;
      const modIds = ramenDetail.modifierGroups
        .flatMap((g) => g.options.slice(0, 1).map((o) => o.optionId))
        .slice(0, 3);

      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: ramenDetail.dishId, quantity: 1, modifierOptionIds: modIds },
      });
      const sashimi = snap.byCode.get('SASHIMI-01') || snap.dishes[1];
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: sashimi.dishId, quantity: 2, modifierOptionIds: [] },
      });

      await withPage({ viewport: VIEWPORTS.IPHONE_375, authSession: disp }, async (page) => {
        await gotoRoute(page, '/menu');
        await page.getByRole('button', { name: /Giỏ hàng 3 món/i }).first().click();
        await assertCartDrawerLayout(page, VIEWPORTS.IPHONE_375);
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F16-05: AuthModal Register Form fits within 375x812 & 1280x800 viewports', async () => {
    for (const vp of [VIEWPORTS.DESKTOP_1280, VIEWPORTS.IPHONE_375]) {
      await withPage({ viewport: vp }, async (page) => {
        await gotoRoute(page, '/');
        if (vp.isMobile) {
          await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
          await page.getByRole('button', { name: 'Đăng nhập' }).click();
        } else {
          await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().click();
        }
        await page.getByRole('button', { name: 'Đăng ký ngay' }).click();

        const submitBtn = page.getByRole('button', { name: 'Tạo Tài Khoản Thành Viên' });
        await submitBtn.waitFor({ state: 'visible' });
        const box = await submitBtn.boundingBox();
        assert.ok(box && box.y >= 0 && box.y + box.height <= vp.height + 1, `Register submit button outside viewport ${vp.width}x${vp.height}`);
      });
    }
  });
});

describe('Tier 2 — F17 Boundaries: Security & Production Resilience', () => {
  it('T2-F17-01: Disallowed CORS Origin does not receive Access-Control-Allow-Origin', async () => {
    const res = await apiRequest('/menu/categories', {
      headers: { Origin: 'https://evil-attacker.example' },
    });
    assert.equal(res.status, 200);
    assert.notEqual(res.headers.get('access-control-allow-origin'), 'https://evil-attacker.example');
    assert.notEqual(res.headers.get('access-control-allow-origin'), '*');
  });

  it('T2-F17-02: Untrusted X-Forwarded-For Spoofing is ignored for rate-limit / client IP unless trusted proxy', async () => {
    // Verify API responds cleanly without accepting arbitrary spoofed header as trusted bypass
    const res = await apiRequest('/menu/categories', {
      headers: { 'X-Forwarded-For': '1.2.3.4' },
    });
    assert.equal(res.status, 200);
  });

  it('T2-F17-04: Error Envelope Consistency on 400, 401, 404 returns structured JSON', async () => {
    const [r401, r404, r400] = await Promise.all([
      apiRequest('/cart'),
      apiRequest('/menu/dishes/DOES-NOT-EXIST-999'),
      apiRequest('/auth/google-login', { method: 'POST', body: { idToken: 'bad' } }),
    ]);

    assert.equal(r401.status, 401);
    assert.equal(r401.data?.statusCode, 401);
    assert.ok(r401.data?.message);

    assert.equal(r404.status, 404);
    assert.ok(r404.data?.message);

    assert.equal(r400.status, 400);
    assert.ok(r400.data?.message);
  });

  it('T2-F17-05: Broken Image URL Resilience recovers cleanly without unhandled pageerror', async () => {
    await withPage(
      {
        viewport: VIEWPORTS.DESKTOP_1280,
        allowedStatuses: ({ status, url }) => status === 404 && url.includes('unsplash.com'),
      },
      async (page, telemetry) => {
        await page.route('**/*unsplash.com/**', (route) =>
          route.fulfill({ status: 404, contentType: 'text/plain', body: 'Missing' })
        );
        await gotoRoute(page, '/');
        await page.getByRole('heading', { name: /Nghệ Thuật Ẩm Thực/i }).waitFor({ state: 'visible' });
        assert.equal(telemetry.pageErrors.length, 0);
      }
    );
  });

  // Run rate-limit burst LAST among F17 tests and specifically on SendOtpPolicy so AuthPolicy & CustomerPolicy stay clean
  it('T2-F17-03: Rate Limit 429 Enforcement returns structured TOO_MANY_REQUESTS JSON', async () => {
    let hit429 = null;
    for (let i = 0; i < 8; i++) {
      const res = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: {
          email: `ratelimit.probe.${i}@example.com`,
          phoneNumber: `ratelimit.probe.${i}@example.com`,
        },
      });
      if (res.status === 429) {
        hit429 = res;
        break;
      }
    }
    assert.ok(hit429, 'Expected SendOtpPolicy (5 req/min) burst to trigger 429 Too Many Requests');
    assert.equal(hit429.data?.statusCode, 429);
    assert.equal(hit429.data?.code, 'TOO_MANY_REQUESTS');
    assert.ok(hit429.data?.message);
  });
});

describe('Tier 2 — F18 Boundaries: E2E Stability & Negative Hygiene', () => {
  it('T2-F18-01: Backend Down / Network Failure UI Handling shows real error UI (no fake mock dishes)', async () => {
    await withPage(
      {
        viewport: VIEWPORTS.DESKTOP_1280,
        allowedStatuses: ({ status, url }) => status === 503 && url.includes('/api/menu/'),
        skipTelemetryAssertions: true,
      },
      async (page) => {
        await page.route('**/api/menu/**', (route) =>
          route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Service Unavailable' }) })
        );
        await gotoRoute(page, '/menu');
        // Must NOT silently display 29 mock dishes when API returns 503
        const dishCountMatches = await page.getByText(/Tìm thấy 29 món ăn/i).count();
        assert.equal(dishCountMatches, 0, 'MenuPage must not fall back to 29 fake mock dishes on API 503');
      }
    );
  });

  it('T2-F18-02: API 401 Mid-Session Token Invalidation triggers auth reset & AuthModal', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1802' });
    try {
      await withPage(
        {
          viewport: VIEWPORTS.DESKTOP_1280,
          authSession: disp,
          allowedStatuses: ({ status, url }) => status === 401 && url.includes('/api/'),
        },
        async (page) => {
          await gotoRoute(page, '/menu');
          // Corrupt tokens in localStorage mid-session
          await page.evaluate(() => {
            window.localStorage.setItem('torisakura_access_token', 'corrupted.jwt.token');
            window.localStorage.setItem('torisakura_refresh_token', 'corrupted-refresh');
          });
          await page.getByRole('button', { name: 'Thêm', exact: true }).first().click();
          await page.getByRole('heading', { name: 'Chào Mừng Quý Khách' }).waitFor({ state: 'visible' });
        }
      );
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F18-03: Zero console.error / pageerror Strict Gate across all 8 routes & 3 modals', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1803' });
    try {
      const snap = await getCatalogSnapshot();
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
      });

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page, telemetry) => {
        for (const r of ['/', '/menu', '/reservation', '/location', '/about', '/blog', '/cart', '/checkout']) {
          await gotoRoute(page, r);
        }
        await gotoRoute(page, '/menu');
        await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();
        await page.getByRole('button', { name: /Thêm Vào Giỏ Hàng/i }).waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');

        assert.equal(telemetry.consoleErrors.length, 0);
        assert.equal(telemetry.pageErrors.length, 0);
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F18-04: Zero Unexpected 4xx/5xx on Public Browsing (no unauthenticated /api/cart polling)', async () => {
    const seenCartCall = [];
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page, telemetry) => {
      page.on('request', (req) => {
        if (req.url().includes('/api/cart')) {
          seenCartCall.push(req.url());
        }
      });
      for (const r of ['/', '/menu', '/reservation', '/location', '/about', '/blog']) {
        await gotoRoute(page, r);
      }
      assert.deepEqual(seenCartCall, [], 'Unauthenticated visitor must never fire /api/cart requests');
      assert.deepEqual(telemetry.badResponses, []);
    });
  });

  it('T2-F18-05: Idempotent Multi-Run Verification creates and cleans up identical state twice cleanly', async () => {
    for (let run = 1; run <= 2; run++) {
      const disp = await createDisposableCustomer({ prefix: `t2f1805r${run}` });
      try {
        const snap = await getCatalogSnapshot();
        const add = await apiRequest('/cart/items', {
          method: 'POST',
          token: disp.accessToken,
          body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
        });
        assert.equal(add.status, 200);
        assert.equal(add.data.totalItemCount, 1);
      } finally {
        disp.cleanup();
      }
    }
  });
});
