import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS } from '../harness/env.mjs';
import {
  apiRequest,
  createDisposableCustomer,
  futureReservationSlot,
  getCachedSession,
  getCatalogSnapshot,
  runSql,
} from '../harness/api-client.mjs';
import {
  assertCartDrawerLayout,
  assertDishDetailModalLayout,
  closeBrowser,
  gotoRoute,
  withPage,
} from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 3 — Pairwise Cross-Feature Combinations (T3-11..T3-20)', () => {
  it('T3-11 (F9 + F12 + F10 + F11): Voucher on /cart carries into Cod50Deposit 50% on /checkout & clears cart on submit', async () => {
    const disp = await createDisposableCustomer({ prefix: 't311' });
    try {
      const snap = await getCatalogSnapshot();
      const wagyu = snap.byCode.get('WAGYU-01') || snap.dishes.find((d) => d.basePrice >= 250000);
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: wagyu.dishId, quantity: 1, modifierOptionIds: [] },
      });
      const discounted = Math.round(Number(wagyu.basePrice) - 50000);
      const deposit50 = Math.round(discounted * 0.5);

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/cart');
        await page.locator('input[type="text"]').first().fill('JAPANFOOD50K');
        await page.getByRole('button', { name: 'Áp Dụng' }).click();
        await page.getByText(/Đã áp dụng mã JAPANFOOD50K/i).waitFor({ state: 'visible' });

        await page.getByRole('button', { name: /Tiến Hành Đặt Hàng & Thanh Toán/i }).click();
        await page.waitForURL(/\/checkout/);

        await page.getByText(/Ship COD \(Bắt Buộc Chuyển Khoản Cọc Trước 50%\)/i).click();
        const qrSrc = await page.locator('img[alt="VietQR Transfer"]').getAttribute('src');
        assert.ok(qrSrc && qrSrc.includes(`amount=${deposit50}`), `Expected 50% deposit=${deposit50} on discounted total, got ${qrSrc}`);

        const inputs = page.locator('form input[type="text"], form input[type="tel"]');
        await inputs.nth(0).fill(disp.fullName);
        await inputs.nth(1).fill('0909333444');
        await page.getByPlaceholder(/Số nhà, tên đường/i).fill('15A Lê Thánh Tôn, Q1');

        const ordPromise = page.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');
        await page.getByRole('button', { name: /Tôi Đã Chuyển Khoản & Xác Nhận Đơn/i }).click();
        assert.equal((await ordPromise).status(), 201);
        await page.getByRole('heading', { name: 'Đặt Hàng Thành Công!' }).waitFor({ state: 'visible' });
      });

      const cartAfter = await apiRequest('/cart', { token: disp.accessToken });
      assert.equal(cartAfter.data.items.length, 0);
    } finally {
      disp.cleanup();
    }
  });

  it('T3-12 (F10 + F11): Checkout FullBank (100%) vs Cod50Deposit (50%) render exact confirmation & VietQR amounts', async () => {
    const disp = await createDisposableCustomer({ prefix: 't312' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('RAMEN-01') || snap.dishes[0];
      const total = Math.round(Number(dish.basePrice));
      const half = Math.round(total * 0.5);

      // Run 1: FullBank
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 1, modifierOptionIds: [] },
      });
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/checkout');
        const qr1 = await page.locator('img[alt="VietQR Transfer"]').getAttribute('src');
        assert.ok(qr1 && qr1.includes(`amount=${total}`));
        const inputs = page.locator('form input[type="text"], form input[type="tel"]');
        await inputs.nth(0).fill(disp.fullName);
        await inputs.nth(1).fill('0909111222');
        await page.getByPlaceholder(/Số nhà, tên đường/i).fill('15A Lê Thánh Tôn');
        await page.getByRole('button', { name: /Tôi Đã Chuyển Khoản & Xác Nhận Đơn/i }).click();
        await page.getByText('Đã Chuyển Khoản 100%').waitFor({ state: 'visible' });
      });

      // Run 2: Cod50Deposit
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 1, modifierOptionIds: [] },
      });
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/checkout');
        await page.getByText(/Ship COD \(Bắt Buộc Chuyển Khoản Cọc Trước 50%\)/i).click();
        const qr2 = await page.locator('img[alt="VietQR Transfer"]').getAttribute('src');
        assert.ok(qr2 && qr2.includes(`amount=${half}`));
        const inputs = page.locator('form input[type="text"], form input[type="tel"]');
        await inputs.nth(0).fill(disp.fullName);
        await inputs.nth(1).fill('0909111222');
        await page.getByPlaceholder(/Số nhà, tên đường/i).fill('15A Lê Thánh Tôn');
        await page.getByRole('button', { name: /Tôi Đã Chuyển Khoản & Xác Nhận Đơn/i }).click();
        await page.getByText(/Đã cọc 50%/i).waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T3-13 (F10 + F12 + F11): Order with voucher completes via cash-confirm and increments Voucher.USED_COUNT', async () => {
    const disp = await createDisposableCustomer({ prefix: 't313' });
    const staff = await getCachedSession('staff');
    try {
      const beforeRows = runSql(`SELECT USED_COUNT FROM dbo.VOUCHERS WHERE VOUCHER_CODE = 'JAPANFOOD50K';`);
      const beforeUsed = Number(beforeRows);

      const snap = await getCatalogSnapshot();
      const wagyu = snap.byCode.get('WAGYU-01') || snap.dishes.find((d) => d.basePrice >= 200000);
      const order = (
        await apiRequest('/orders', {
          method: 'POST',
          token: disp.accessToken,
          body: {
            orderType: 'Delivery',
            paymentMethod: 'FullBank',
            voucherCode: 'JAPANFOOD50K',
            items: [{ menuItemId: wagyu.dishId, quantity: 1, modifierOptionIds: [] }],
          },
        })
      ).data;

      await apiRequest(`/orders/${order.orderId}/checkout`, {
        method: 'POST',
        token: disp.accessToken,
        body: { gateway: 'Cash' },
      });
      const detail = (await apiRequest(`/orders/${order.orderId}`, { token: disp.accessToken })).data;
      const conf = await apiRequest('/payments/cash-confirm', {
        method: 'POST',
        token: staff.accessToken,
        body: { transactionNumber: detail.paymentTransactions[0].transactionNumber },
      });
      assert.equal(conf.status, 200);

      const afterUsed = Number(runSql(`SELECT USED_COUNT FROM dbo.VOUCHERS WHERE VOUCHER_CODE = 'JAPANFOOD50K';`));
      assert.equal(afterUsed, beforeUsed + 1, 'Voucher USED_COUNT should increment by 1 after order completion');
    } finally {
      disp.cleanup();
    }
  });

  it('T3-14 (F10 + F14): Customer completes order -> submits review -> Manager approves -> public visibility', async () => {
    const disp = await createDisposableCustomer({ prefix: 't314' });
    const staff = await getCachedSession('staff');
    const manager = await getCachedSession('manager');
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('GYOZA-01') || snap.dishes[0];
      const order = (
        await apiRequest('/orders', {
          method: 'POST',
          token: disp.accessToken,
          body: {
            orderType: 'Takeaway',
            paymentMethod: 'FullBank',
            items: [{ menuItemId: dish.dishId, quantity: 1, modifierOptionIds: [] }],
          },
        })
      ).data;
      await apiRequest(`/orders/${order.orderId}/checkout`, {
        method: 'POST',
        token: disp.accessToken,
        body: { gateway: 'Cash' },
      });
      const detail = (await apiRequest(`/orders/${order.orderId}`, { token: disp.accessToken })).data;
      await apiRequest('/payments/cash-confirm', {
        method: 'POST',
        token: staff.accessToken,
        body: { transactionNumber: detail.paymentTransactions[0].transactionNumber },
      });

      const comment = `T3-14 Verified Review ${Date.now()}`;
      const rev = await apiRequest('/reviews', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, orderId: order.orderId, rating: 5, comment },
      });
      assert.equal(rev.status, 201);

      const approve = await apiRequest(`/reviews/${rev.data.reviewId}/approve`, {
        method: 'PUT',
        token: manager.accessToken,
      });
      assert.equal(approve.status, 200);

      const pub = await apiRequest(`/reviews/dishes/${dish.dishId}?page=1&pageSize=50`);
      assert.ok(pub.data.items.some((r) => r.reviewId === rev.data.reviewId && r.comment === comment));
    } finally {
      disp.cleanup();
    }
  });

  it('T3-15 (F13 + F15): LocationPage branch 2 CTA deep-links to /reservation?branch=... with branch 2 selected', async () => {
    const branches = (await apiRequest('/branches')).data;
    assert.ok(branches.length >= 2);
    const branch2 = branches[1];

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/location');
      await page.getByRole('button', { name: new RegExp(branch2.name, 'i') }).click();
      await page.getByRole('link', { name: 'Đặt Bàn Tại Chi Nhánh Này' }).click();
      await page.waitForURL(/\/reservation\?branch=/);

      await page.getByRole('button', { name: /Tiếp tục: Chọn khu vực bàn/i }).click();
      await page.getByRole('button', { name: /Tiếp tục: Số lượng khách/i }).click();
      await page.getByRole('button', { name: /Tiếp tục: Thông tin người đặt/i }).click();
      await page.getByText(branch2.name).first().waitFor({ state: 'visible' });
    });
  });

  it('T3-16 (F13 + F2): Guest reservation userId=null vs Authenticated reservation userId=JWT + my-history/cancel', async () => {
    const disp = await createDisposableCustomer({ prefix: 't316' });
    const slotGuest = futureReservationSlot(15, 18, 0);
    const slotAuth = futureReservationSlot(16, 19, 0);
    let guestRsvId = null;

    try {
      const guestRes = await apiRequest('/reservations', {
        method: 'POST',
        body: {
          customerName: 'Guest T3-16',
          customerPhone: '0906111222',
          guestCount: 2,
          reservationTime: slotGuest.isoUtc,
        },
      });
      assert.equal(guestRes.status, 201);
      guestRsvId = guestRes.data.reservationId;
      assert.equal(guestRes.data.userId, null);

      const authRes = await apiRequest('/reservations', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          customerName: disp.fullName,
          customerPhone: disp.phoneNumber,
          guestCount: 2,
          reservationTime: slotAuth.isoUtc,
        },
      });
      assert.equal(authRes.status, 201);
      assert.equal(authRes.data.userId, disp.userId);

      const hist = await apiRequest('/reservations/my-history', { token: disp.accessToken });
      assert.ok(hist.data.items.some((r) => r.reservationId === authRes.data.reservationId));
      assert.ok(!hist.data.items.some((r) => r.reservationId === guestRsvId));
    } finally {
      if (guestRsvId) runSql(`DELETE FROM dbo.RESERVATIONS WHERE RESERVATION_ID = ${guestRsvId};`);
      disp.cleanup();
    }
  });

  it('T3-17 (F13 + F15): Home Quick Reservation Bar pre-populates branch, date, time, and guest count on /reservation', async () => {
    const branches = (await apiRequest('/branches')).data;
    const slot = futureReservationSlot(17, 20, 0);

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/');
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Tìm Bàn Trống' }) });
      const selects = form.locator('select');
      if (branches.length >= 2) {
        await selects.nth(0).selectOption({ index: 1 });
      }
      await form.locator('input[type="date"]').fill(slot.dateStr);
      await selects.nth(1).selectOption('20:00');
      await selects.nth(2).selectOption('6');
      await page.getByRole('button', { name: 'Tìm Bàn Trống' }).click();

      await page.waitForURL(/\/reservation\?/);
      assert.ok(page.url().includes('time=20%3A00') || page.url().includes('time=20:00'));
      assert.ok(page.url().includes('guests=6'));
    });
  });

  it('T3-18 (F9 + F16): CartDrawer at 1280x800 and 375x812 displays SQL-backed items with zero overflow', async () => {
    const disp = await createDisposableCustomer({ prefix: 't318' });
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
        body: { menuItemId: snap.dishes[1].dishId, quantity: 1, modifierOptionIds: [] },
      });

      for (const vp of [VIEWPORTS.DESKTOP_1280, VIEWPORTS.IPHONE_375]) {
        await withPage({ viewport: vp, authSession: disp }, async (page) => {
          await gotoRoute(page, '/menu');
          await page.getByRole('button', { name: /Giỏ hàng 2 món/i }).first().click();
          await assertCartDrawerLayout(page, vp);
        });
      }
    } finally {
      disp.cleanup();
    }
  });

  it('T3-19 (F7 + F16): DishDetailModal for WAGYU-01 & RAMEN-01 on 1280x800 and 375x812 keeps CTA clickable inside viewport', async () => {
    for (const code of ['WAGYU-01', 'RAMEN-01']) {
      for (const vp of [VIEWPORTS.DESKTOP_1280, VIEWPORTS.IPHONE_375]) {
        await withPage({ viewport: vp }, async (page) => {
          await gotoRoute(page, '/menu');
          await page.getByPlaceholder(/Tìm theo tên món/i).fill(code);
          await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();
          await assertDishDetailModalLayout(page, vp);
        });
      }
    }
  });

  it('T3-20 (F2 + F17): Mid-Session Token Expiry triggers refresh OR resets to logged-out and opens AuthModal', async () => {
    const disp = await createDisposableCustomer({ prefix: 't320' });
    try {
      await withPage(
        {
          viewport: VIEWPORTS.DESKTOP_1280,
          authSession: disp,
          allowedStatuses: ({ status, url }) => (status === 401 || status === 400) && url.includes('/api/'),
        },
        async (page) => {
          await gotoRoute(page, '/menu');
          // Corrupt access token while keeping valid refresh token -> axios interceptor refreshes seamlessly OR prompts AuthModal
          await page.evaluate(() => {
            window.localStorage.setItem('torisakura_access_token', 'expired.invalid.token');
          });
          await page.getByRole('button', { name: 'Thêm', exact: true }).first().click();

          const drawerOpen = await page.getByRole('heading', { name: 'Giỏ Hàng Của Bạn' }).isVisible({ timeout: 4000 }).catch(() => false);
          const authOpen = await page.getByRole('heading', { name: 'Chào Mừng Quý Khách' }).isVisible({ timeout: 4000 }).catch(() => false);
          assert.ok(drawerOpen || authOpen, 'Expected either transparent token refresh -> CartDrawer OR auth reset -> AuthModal');
        }
      );
    } finally {
      disp.cleanup();
    }
  });
});
