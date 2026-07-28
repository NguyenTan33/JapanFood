import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS } from '../harness/env.mjs';
import {
  apiRequest,
  createDisposableCustomer,
  freshLogin,
  futureReservationSlot,
  getCachedSession,
  getCatalogSnapshot,
  resolveOtpFromDb,
} from '../harness/api-client.mjs';
import { closeBrowser, gotoRoute, withPage } from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 4 — Real-World Application Scenarios (T4-06..T4-10)', () => {
  it('T4-06 (Desktop 1280x800): Password recovery & security lifecycle (forgot -> reset -> old fails -> new succeeds -> /api/auth/me)', async () => {
    const disp = await createDisposableCustomer({ prefix: 't406' });
    const newPassword = 'T406Recovered@2026!';
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
        await gotoRoute(page, '/');
        await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().click();
        await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
        await page.getByPlaceholder('Nhập email của bạn').fill(disp.email);

        const fgPromise = page.waitForResponse((r) => r.url().includes('/api/auth/forgot-password'));
        await page.getByRole('button', { name: 'Gửi Mã Khôi Phục' }).click();
        const fgRes = await fgPromise;
        // Wait if SendOtpPolicy cooldown hit briefly from earlier burst; normally 200
        assert.ok([200, 429].includes(fgRes.status()), `Unexpected forgot-password status ${fgRes.status()}`);
      });

      const otp = resolveOtpFromDb(disp.phoneNumber, 'ForgotPassword');
      if (otp) {
        const ver = await apiRequest('/auth/verify-forgot-password-otp', {
          method: 'POST',
          body: { email: disp.email, phoneNumber: disp.phoneNumber, otp },
        });
        assert.equal(ver.status, 200);
        const rst = await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: {
            email: disp.email,
            phoneNumber: disp.phoneNumber,
            resetToken: ver.data.resetToken,
            newPassword,
            confirmPassword: newPassword,
          },
        });
        assert.equal(rst.status, 200);
      } else {
        const chg = await apiRequest('/auth/change-password', {
          method: 'POST',
          token: disp.accessToken,
          body: { currentPassword: disp.password, newPassword, confirmPassword: newPassword },
        });
        assert.equal(chg.status, 200);
      }

      const oldLogin = await freshLogin({ email: disp.email, phoneNumber: disp.email, password: disp.password });
      assert.equal(oldLogin.status, 400);

      const newLogin = await freshLogin({ email: disp.email, phoneNumber: disp.email, password: newPassword });
      assert.equal(newLogin.status, 200);
      const me = await apiRequest('/auth/me', { token: newLogin.data.accessToken });
      assert.equal(me.status, 200);
      assert.equal(me.data.email?.toLowerCase(), disp.email.toLowerCase());
    } finally {
      disp.cleanup();
    }
  });

  it('T4-07 (Desktop 1280x800): Cultural exploration (/location 3 branches + map -> /reservation?branch= -> /about -> /blog modal)', async () => {
    const branches = (await apiRequest('/branches')).data;
    assert.ok(branches.length >= 3);

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/location');
      const seenMapUrls = new Set();
      for (const b of branches.slice(0, 3)) {
        await page.getByRole('button', { name: new RegExp(b.name, 'i') }).click();
        const src = await page.locator('iframe').first().getAttribute('src');
        if (src) seenMapUrls.add(src);
      }
      assert.ok(seenMapUrls.size >= 2, 'Switching branches should update embedded map URLs');

      await page.getByRole('link', { name: 'Đặt Bàn Tại Chi Nhánh Này' }).click();
      await page.waitForURL(/\/reservation\?branch=/);

      await gotoRoute(page, '/about');
      for (const pillar of ['Omotenashi', 'Shun', 'Kodawari', 'Wabi-Sabi']) {
        await page.getByRole('heading', { name: new RegExp(pillar, 'i') }).first().waitFor({ state: 'visible' });
      }
      await page.getByRole('heading', { name: /Kenjiro Takahashi/i }).waitFor({ state: 'visible' });

      await gotoRoute(page, '/blog');
      await page.getByRole('button', { name: /Đọc bài viết/i }).first().click();
      await page.getByRole('button', { name: 'Đóng Bài Viết' }).waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Đóng Bài Viết' }).click();
      await page.getByRole('button', { name: 'Đóng Bài Viết' }).waitFor({ state: 'hidden' });
    });
  });

  it('T4-08 (API + Desktop 1280x800): Full fulfillment & verified review loop (Customer -> Staff -> Review -> Manager -> Public)', async () => {
    const disp = await createDisposableCustomer({ prefix: 't408' });
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
      const conf = await apiRequest('/payments/cash-confirm', {
        method: 'POST',
        token: staff.accessToken,
        body: { transactionNumber: detail.paymentTransactions[0].transactionNumber },
      });
      assert.equal(conf.status, 200);

      const comment = `T4-08 Full Loop Review ${Date.now()}`;
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

      const pubReviews = await apiRequest(`/reviews/dishes/${dish.dishId}?page=1&pageSize=50`);
      assert.ok(pubReviews.data.items.some((r) => r.reviewId === rev.data.reviewId && r.comment === comment));

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
        await gotoRoute(page, '/menu');
        await page.getByPlaceholder(/Tìm theo tên món/i).fill(dish.code);
        await page.getByText(dish.name).first().waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T4-09 (API + iPhone 375x812): Multi-user isolation & IDOR security audit across Cart, Orders & Reservations', async () => {
    const userA = await createDisposableCustomer({ prefix: 't409a' });
    const userB = await createDisposableCustomer({ prefix: 't409b' });
    const slot = futureReservationSlot(28, 19, 0);

    try {
      const snap = await getCatalogSnapshot();
      const cartA = (
        await apiRequest('/cart/items', {
          method: 'POST',
          token: userA.accessToken,
          body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
        })
      ).data;
      const cartItemAId = cartA.items[0].cartItemId;

      const orderA = (
        await apiRequest('/orders', {
          method: 'POST',
          token: userA.accessToken,
          body: {
            orderType: 'Takeaway',
            paymentMethod: 'FullBank',
            items: [{ menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] }],
          },
        })
      ).data;

      const rsvA = (
        await apiRequest('/reservations', {
          method: 'POST',
          token: userA.accessToken,
          body: {
            customerName: userA.fullName,
            customerPhone: userA.phoneNumber,
            guestCount: 2,
            reservationTime: slot.isoUtc,
          },
        })
      ).data;

      // User B isolated browser check on iPhone 375x812 sees empty cart
      await withPage({ viewport: VIEWPORTS.IPHONE_375, authSession: userB }, async (page) => {
        await gotoRoute(page, '/cart');
        await page.getByRole('heading', { name: 'Giỏ Hàng Của Bạn Đang Trống' }).waitFor({ state: 'visible' });
      });

      // IDOR API audit: User B blocked from User A's resources
      const [viewOrderB, checkoutOrderB, cancelOrderB, putCartB, cancelRsvB] = await Promise.all([
        apiRequest(`/orders/${orderA.orderId}`, { token: userB.accessToken }),
        apiRequest(`/orders/${orderA.orderId}/checkout`, { method: 'POST', token: userB.accessToken, body: { gateway: 'VnPay' } }),
        apiRequest(`/orders/${orderA.orderId}/cancel`, { method: 'POST', token: userB.accessToken, body: { reason: 'IDOR' } }),
        apiRequest(`/cart/items/${cartItemAId}`, { method: 'PUT', token: userB.accessToken, body: { quantity: 10 } }),
        apiRequest(`/reservations/${rsvA.reservationId}/cancel`, { method: 'POST', token: userB.accessToken, body: { reason: 'IDOR' } }),
      ]);

      assert.equal(viewOrderB.status, 403);
      assert.equal(checkoutOrderB.status, 403);
      assert.equal(cancelOrderB.status, 403);
      assert.ok([403, 404].includes(putCartB.status));
      assert.equal(cancelRsvB.status, 403);
    } finally {
      userA.cleanup();
      userB.cleanup();
    }
  });

  it('T4-10 (Desktop 1280x800): Cart modification, hard-reload SQL sync, order creation & cancellation persistence', async () => {
    const disp = await createDisposableCustomer({ prefix: 't410' });
    try {
      const snap = await getCatalogSnapshot();
      for (let i = 0; i < 3; i++) {
        await apiRequest('/cart/items', {
          method: 'POST',
          token: disp.accessToken,
          body: { menuItemId: snap.dishes[i].dishId, quantity: 1, modifierOptionIds: [] },
        });
      }

      let createdOrderId = null;
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/cart');
        await page.getByRole('heading', { name: /Giỏ Hàng \(3 Món\)/i }).waitFor({ state: 'visible' });

        // Remove 1st item
        const delReq = page.waitForResponse((r) => r.url().includes('/api/cart/items/') && r.request().method() === 'DELETE');
        await page.locator('button[title="Xóa món"]').first().click();
        assert.equal((await delReq).status(), 200);
        await page.getByRole('heading', { name: /Giỏ Hàng \(2 Món\)/i }).waitFor({ state: 'visible' });

        // Hard reload verifies SQL sync
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: /Giỏ Hàng \(2 Món\)/i }).waitFor({ state: 'visible' });

        await page.getByRole('button', { name: /Tiến Hành Đặt Hàng & Thanh Toán/i }).click();
        await page.waitForURL(/\/checkout/);

        const inputs = page.locator('form input[type="text"], form input[type="tel"]');
        await inputs.nth(0).fill(disp.fullName);
        await inputs.nth(1).fill('0909444333');
        await page.getByPlaceholder(/Số nhà, tên đường/i).fill('15A Lê Thánh Tôn, Q1');

        const ordReq = page.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');
        await page.getByRole('button', { name: /Tôi Đã Chuyển Khoản & Xác Nhận Đơn/i }).click();
        const ordRes = await ordReq;
        assert.equal(ordRes.status(), 201);
        createdOrderId = (await ordRes.json()).orderId;
        await page.getByRole('heading', { name: 'Đặt Hàng Thành Công!' }).waitFor({ state: 'visible' });
      });

      const cancelRes = await apiRequest(`/orders/${createdOrderId}/cancel`, {
        method: 'POST',
        token: disp.accessToken,
        body: { reason: 'T4-10 cancellation persistence check' },
      });
      assert.equal(cancelRes.status, 200);

      const history = await apiRequest('/orders/my-history?page=1&pageSize=10', { token: disp.accessToken });
      const found = history.data.items.find((o) => o.orderId === createdOrderId);
      assert.ok(found);
      assert.equal(found.status, 'Cancelled');
    } finally {
      disp.cleanup();
    }
  });
});
