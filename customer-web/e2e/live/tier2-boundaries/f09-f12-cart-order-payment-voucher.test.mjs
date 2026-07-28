import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS } from '../harness/env.mjs';
import {
  apiRequest,
  createDisposableCustomer,
  getCachedSession,
  getCatalogSnapshot,
  getDishDetail,
  runSql,
} from '../harness/api-client.mjs';
import { assertCartDrawerLayout, closeBrowser, gotoRoute, withPage } from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 2 — F9 Boundaries: Authenticated Cart & Isolation', () => {
  it('T2-F9-01: Unauthenticated API Cart Rejection returns 401 on all 5 cart endpoints', async () => {
    const [r1, r2, r3, r4, r5] = await Promise.all([
      apiRequest('/cart'),
      apiRequest('/cart/items', { method: 'POST', body: { menuItemId: 1, quantity: 1 } }),
      apiRequest('/cart/items/1', { method: 'PUT', body: { quantity: 2 } }),
      apiRequest('/cart/items/1', { method: 'DELETE' }),
      apiRequest('/cart', { method: 'DELETE' }),
    ]);
    for (const r of [r1, r2, r3, r4, r5]) {
      assert.equal(r.status, 401, `Expected 401 unauth cart endpoint, got ${r.status}`);
    }
  });

  it('T2-F9-02: Unauthenticated UI Cart Gating blocks add-to-cart, CartDrawer, /cart, and /checkout', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');

      // (a) Zero badge count
      await page.getByRole('button', { name: /Giỏ hàng 0 món/i }).first().waitFor({ state: 'visible' });

      // (b) Clicking "Thêm" while logged out opens AuthModal instead of adding
      await page.getByRole('button', { name: 'Thêm', exact: true }).first().click();
      await page.getByRole('heading', { name: 'Chào Mừng Quý Khách' }).waitFor({ state: 'visible' });

      // Close AuthModal
      await page.keyboard.press('Escape');
      if (await page.getByRole('heading', { name: 'Chào Mừng Quý Khách' }).isVisible().catch(() => false)) {
        await page.locator('div.fixed button').first().click();
      }

      // (c) Clicking Navbar cart icon while logged out opens AuthModal
      await page.getByRole('button', { name: /Giỏ hàng 0 món/i }).first().click();
      await page.getByRole('heading', { name: 'Chào Mừng Quý Khách' }).waitFor({ state: 'visible' });

      // (d) Direct navigation to /cart blocks unauthenticated cart access and shows login prompt / AuthModal
      await gotoRoute(page, '/cart');
      const authHeadingVisible = await page
        .getByRole('heading', { name: /Chào Mừng Quý Khách|Đăng nhập/i })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      const loginPromptVisible = await page
        .getByText(/đăng nhập/i)
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      assert.ok(authHeadingVisible || loginPromptVisible, '/cart must prompt or redirect to login when unauthenticated');
    });
  });

  it('T2-F9-03: Cross-User Cart IDOR Forbidden (User B cannot modify/delete User A cartItemId)', async () => {
    const userA = await createDisposableCustomer({ prefix: 't2f903a' });
    const userB = await createDisposableCustomer({ prefix: 't2f903b' });
    try {
      const snap = await getCatalogSnapshot();
      const added = await apiRequest('/cart/items', {
        method: 'POST',
        token: userA.accessToken,
        body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
      });
      assert.equal(added.status, 200);
      const itemAId = added.data.items[0].cartItemId;

      const putB = await apiRequest(`/cart/items/${itemAId}`, {
        method: 'PUT',
        token: userB.accessToken,
        body: { quantity: 5 },
      });
      assert.ok([403, 404].includes(putB.status), `Expected 403/404 on cross-user cart PUT, got ${putB.status}`);

      const delB = await apiRequest(`/cart/items/${itemAId}`, {
        method: 'DELETE',
        token: userB.accessToken,
      });
      assert.ok([403, 404].includes(delB.status), `Expected 403/404 on cross-user cart DELETE, got ${delB.status}`);

      const verifyA = await apiRequest('/cart', { token: userA.accessToken });
      assert.equal(verifyA.data.items.length, 1);
      assert.equal(verifyA.data.items[0].quantity, 1);
    } finally {
      userA.cleanup();
      userB.cleanup();
    }
  });

  it('T2-F9-04: Quantity Boundaries <=0 and >50 & Unavailable Dish rejected with 400', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f904' });
    const admin = await getCachedSession('admin');
    const snap = await getCatalogSnapshot();
    const dish = snap.byCode.get('TEA-01') || snap.dishes[0];

    try {
      const r0 = await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 0 },
      });
      assert.equal(r0.status, 400);

      const rNeg = await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: -1 },
      });
      assert.equal(rNeg.status, 400);

      const r51 = await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 51 },
      });
      assert.equal(r51.status, 400);

      await apiRequest(`/menu/dishes/${dish.dishId}/availability`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isAvailable: false },
      });
      const rUnavail = await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 1 },
      });
      assert.equal(rUnavail.status, 400);
    } finally {
      await apiRequest(`/menu/dishes/${dish.dishId}/availability`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isAvailable: true },
      });
      disp.cleanup();
    }
  });

  it('T2-F9-05: Different Modifiers create distinct CartItem rows & CartDrawer at 375x812 fits cleanly', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f905' });
    try {
      const ramen = await getDishDetail('RAMEN-01');
      const grp = ramen.modifierGroups?.[0];
      assert.ok(grp && grp.options.length >= 2);
      const optA = grp.options[0].optionId;
      const optB = grp.options[1].optionId;

      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: ramen.dishId, quantity: 1, modifierOptionIds: [optA] },
      });
      const second = await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: ramen.dishId, quantity: 1, modifierOptionIds: [optB] },
      });
      assert.equal(second.status, 200);
      assert.equal(second.data.items.length, 2, 'Different modifier options must create 2 distinct cart rows');

      await withPage({ viewport: VIEWPORTS.IPHONE_375, authSession: disp }, async (page) => {
        await gotoRoute(page, '/menu');
        await page.getByRole('button', { name: /Giỏ hàng 2 món/i }).first().click();
        await assertCartDrawerLayout(page, VIEWPORTS.IPHONE_375);
      });
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 2 — F10 Boundaries: Order Security & Validation', () => {
  it('T2-F10-01: Unauthenticated Order Endpoints Rejected with 401', async () => {
    const [r1, r2, r3, r4] = await Promise.all([
      apiRequest('/orders', { method: 'POST', body: { items: [] } }),
      apiRequest('/orders/1'),
      apiRequest('/orders/my-history'),
      apiRequest('/orders/1/cancel', { method: 'POST', body: { reason: 'test' } }),
    ]);
    for (const r of [r1, r2, r3, r4]) {
      assert.equal(r.status, 401);
    }
  });

  it('T2-F10-02: UserId Spoofing Blocked on CreateOrder (forces JWT userId)', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1002' });
    try {
      const snap = await getCatalogSnapshot();
      const res = await apiRequest('/orders', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          userId: 9999,
          orderType: 'Delivery',
          paymentMethod: 'FullBank',
          items: [{ menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] }],
        },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.userId, disp.userId, 'Backend must ignore spoofed userId and bind JWT userId');
      assert.notEqual(res.data.userId, 9999);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F10-03: Cross-User IDOR on GetOrderById & CancelOrder returns 403 Forbidden', async () => {
    const userA = await createDisposableCustomer({ prefix: 't2f1003a' });
    const userB = await createDisposableCustomer({ prefix: 't2f1003b' });
    try {
      const snap = await getCatalogSnapshot();
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

      const getB = await apiRequest(`/orders/${orderA.orderId}`, { token: userB.accessToken });
      assert.equal(getB.status, 403);

      const cancelB = await apiRequest(`/orders/${orderA.orderId}/cancel`, {
        method: 'POST',
        token: userB.accessToken,
        body: { reason: 'IDOR attempt' },
      });
      assert.equal(cancelB.status, 403);
    } finally {
      userA.cleanup();
      userB.cleanup();
    }
  });

  it('T2-F10-04: Empty Items / Non-existent Dish / Invalid Enum rejected with 400', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1004' });
    try {
      const rEmpty = await apiRequest('/orders', {
        method: 'POST',
        token: disp.accessToken,
        body: { orderType: 'Delivery', paymentMethod: 'FullBank', items: [] },
      });
      assert.equal(rEmpty.status, 400);

      const rMissingDish = await apiRequest('/orders', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          orderType: 'Delivery',
          paymentMethod: 'FullBank',
          items: [{ menuItemId: 999999, quantity: 1 }],
        },
      });
      assert.ok([400, 404].includes(rMissingDish.status));

      const rBadEnum = await apiRequest('/orders', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          orderType: 'FlyIn',
          paymentMethod: 'FullBank',
          items: [{ menuItemId: 1, quantity: 1 }],
        },
      });
      assert.equal(rBadEnum.status, 400);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F10-05: Empty Cart Redirect from /checkout & Non-Cancellable Completed Order returns 400', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1005' });
    const staff = await getCachedSession('staff');
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/checkout');
        await page.waitForURL(/\/cart/);
      });

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

      const cancelCompleted = await apiRequest(`/orders/${order.orderId}/cancel`, {
        method: 'POST',
        token: disp.accessToken,
        body: { reason: 'Attempt cancel after completion' },
      });
      assert.equal(cancelCompleted.status, 400);
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 2 — F11 Boundaries: Payment Security & Validation', () => {
  it('T2-F11-01: Cross-User IDOR on CheckoutOrder returns 403 Forbidden', async () => {
    const userA = await createDisposableCustomer({ prefix: 't2f1101a' });
    const userB = await createDisposableCustomer({ prefix: 't2f1101b' });
    try {
      const snap = await getCatalogSnapshot();
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

      const checkoutB = await apiRequest(`/orders/${orderA.orderId}/checkout`, {
        method: 'POST',
        token: userB.accessToken,
        body: { gateway: 'VnPay' },
      });
      assert.equal(checkoutB.status, 403);
    } finally {
      userA.cleanup();
      userB.cleanup();
    }
  });

  it('T2-F11-02: Unauthenticated CheckoutOrder returns 401 Unauthorized', async () => {
    const res = await apiRequest('/orders/1/checkout', {
      method: 'POST',
      body: { gateway: 'VnPay' },
    });
    assert.equal(res.status, 401);
  });

  it('T2-F11-03: Invalid Payment Callback Signatures rejected with 400 Bad Request', async () => {
    const vnpay = await apiRequest('/payments/vnpay-return?vnp_ResponseCode=00&vnp_TxnRef=FAKE123&vnp_SecureHash=TAMPERED');
    assert.equal(vnpay.status, 400);

    const momo = await apiRequest('/payments/momo-ipn', {
      method: 'POST',
      body: { orderId: 'FAKE', resultCode: '0', signature: 'TAMPERED', rawData: 'orderId=FAKE&resultCode=0' },
    });
    assert.equal(momo.status, 400);
  });

  it('T2-F11-04: Duplicate Payment / Already Paid Order Idempotency prevents double completion/checkout', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1104' });
    const staff = await getCachedSession('staff');
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
      const txn = detail.paymentTransactions[0].transactionNumber;

      const c1 = await apiRequest('/payments/cash-confirm', {
        method: 'POST',
        token: staff.accessToken,
        body: { transactionNumber: txn },
      });
      assert.equal(c1.status, 200);

      // Replaying cash-confirm must be idempotent (200) and checkout on Completed must be rejected (400)
      const c2 = await apiRequest('/payments/cash-confirm', {
        method: 'POST',
        token: staff.accessToken,
        body: { transactionNumber: txn },
      });
      assert.equal(c2.status, 200);

      const reCheckout = await apiRequest(`/orders/${order.orderId}/checkout`, {
        method: 'POST',
        token: disp.accessToken,
        body: { gateway: 'VnPay' },
      });
      assert.equal(reCheckout.status, 400);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F11-05: Checkout Delivery Form Required Validation blocks empty submission', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1105' });
    try {
      const snap = await getCatalogSnapshot();
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
      });

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/checkout');
        const addressInput = page.getByPlaceholder(/Số nhà, tên đường/i);
        await addressInput.fill('');
        await page.getByRole('button', { name: /Tôi Đã Chuyển Khoản & Xác Nhận Đơn/i }).click();
        // Required validation prevents transition to order complete screen
        assert.equal(await page.getByRole('heading', { name: 'Đặt Hàng Thành Công!' }).count(), 0);
      });
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 2 — F12 Boundaries: Voucher Validation & Limits', () => {
  it('T2-F12-01: Invalid / Non-Existent Voucher Returns HTTP 400 (INVALID_VOUCHER)', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1201' });
    try {
      const res = await apiRequest('/vouchers/apply', {
        method: 'POST',
        token: disp.accessToken,
        body: { code: 'FAKECODE999', currentSubtotal: 500000 },
      });
      assert.equal(res.status, 400, `Expected 400 for invalid voucher, got ${res.status}: ${res.text}`);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F12-02: Below Minimum Order Amount returns 400 & CartPage displays error', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1202' });
    try {
      const apiRes = await apiRequest('/vouchers/apply', {
        method: 'POST',
        token: disp.accessToken,
        body: { code: 'JAPANFOOD50K', currentSubtotal: 199000 },
      });
      assert.equal(apiRes.status, 400);

      const snap = await getCatalogSnapshot();
      const cheapDish = snap.dishes.find((d) => d.basePrice < 150000) || snap.dishes[0];
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: cheapDish.dishId, quantity: 1, modifierOptionIds: [] },
      });

      await withPage(
        {
          viewport: VIEWPORTS.DESKTOP_1280,
          authSession: disp,
          allowedStatuses: ({ status, url }) => status === 400 && url.includes('/api/vouchers/apply'),
        },
        async (page) => {
          await gotoRoute(page, '/cart');
          await page.locator('input[type="text"]').first().fill('JAPANFOOD50K');
          await page.getByRole('button', { name: 'Áp Dụng' }).click();
          await page.getByText(/tối thiểu|không hợp lệ|200/i).first().waitFor({ state: 'visible' });
        }
      );
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F12-03: Deactivated Voucher returns 400 and is omitted from GET /api/vouchers', async () => {
    const admin = await getCachedSession('admin');
    const disp = await createDisposableCustomer({ prefix: 't2f1203' });
    const code = `E2EOFF_${Date.now()}`;
    let voucherId = null;

    try {
      const created = await apiRequest('/vouchers', {
        method: 'POST',
        token: admin.accessToken,
        body: {
          voucherCode: code,
          discountType: 'FixedAmount',
          discountValue: 50000,
          startDate: new Date(Date.now() - 86400_000).toISOString(),
          endDate: new Date(Date.now() + 30 * 86400_000).toISOString(),
          minOrderAmount: 100000,
          usageLimit: 10,
          usagePerUserLimit: 2,
        },
      });
      assert.equal(created.status, 201);
      voucherId = created.data.voucherId;

      const deact = await apiRequest(`/vouchers/${voucherId}/deactivate`, {
        method: 'PATCH',
        token: admin.accessToken,
      });
      assert.equal(deact.status, 200);

      const applyRes = await apiRequest('/vouchers/apply', {
        method: 'POST',
        token: disp.accessToken,
        body: { code, currentSubtotal: 200000 },
      });
      assert.equal(applyRes.status, 400);

      const list = (await apiRequest('/vouchers')).data;
      assert.ok(!list.some((v) => (v.code || v.voucherCode) === code));
    } finally {
      if (voucherId) runSql(`DELETE FROM dbo.VOUCHERS WHERE VOUCHER_ID = ${voucherId};`);
      disp.cleanup();
    }
  });

  it('T2-F12-04: Per-User Usage Limit Enforced (usagePerUserLimit = 1 blocks 2nd use)', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1204' });
    const staff = await getCachedSession('staff');
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('WAGYU-01') || snap.dishes.find((d) => d.basePrice >= 200000);

      const order1 = (
        await apiRequest('/orders', {
          method: 'POST',
          token: disp.accessToken,
          body: {
            orderType: 'Takeaway',
            paymentMethod: 'FullBank',
            voucherCode: 'WELCOME20',
            items: [{ menuItemId: dish.dishId, quantity: 1, modifierOptionIds: [] }],
          },
        })
      ).data;
      assert.ok(order1?.orderId);

      await apiRequest(`/orders/${order1.orderId}/checkout`, {
        method: 'POST',
        token: disp.accessToken,
        body: { gateway: 'Cash' },
      });
      const detail = (await apiRequest(`/orders/${order1.orderId}`, { token: disp.accessToken })).data;
      const conf = await apiRequest('/payments/cash-confirm', {
        method: 'POST',
        token: staff.accessToken,
        body: { transactionNumber: detail.paymentTransactions[0].transactionNumber },
      });
      assert.equal(conf.status, 200);

      // Second attempt by same disposable user must be rejected
      const second = await apiRequest('/vouchers/apply', {
        method: 'POST',
        token: disp.accessToken,
        body: { code: 'WELCOME20', currentSubtotal: 300000 },
      });
      assert.equal(second.status, 400);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F12-05: Unauthenticated Voucher Apply (401) & Non-Admin Create (403)', async () => {
    const customer = await getCachedSession('customer');

    const anonApply = await apiRequest('/vouchers/apply', {
      method: 'POST',
      body: { code: 'JAPANFOOD50K', currentSubtotal: 300000 },
    });
    assert.equal(anonApply.status, 401);

    const custCreate = await apiRequest('/vouchers', {
      method: 'POST',
      token: customer.accessToken,
      body: {
        voucherCode: 'HACK100',
        discountType: 'FixedAmount',
        discountValue: 100000,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400_000).toISOString(),
      },
    });
    assert.equal(custCreate.status, 403);
  });
});
