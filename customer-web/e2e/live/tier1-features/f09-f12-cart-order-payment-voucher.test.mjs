import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS } from '../harness/env.mjs';
import {
  apiRequest,
  cancelOrder,
  clearCart,
  createDisposableCustomer,
  getCachedSession,
  getCatalogSnapshot,
  getDishDetail,
} from '../harness/api-client.mjs';
import { closeBrowser, gotoRoute, withPage } from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 1 — F9: Authenticated Online Cart', () => {
  it('T1-F9-01: API Add Item with Modifiers & Merge merges identical menuItemId + modifierOptionIds', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f901' });
    try {
      const ramen = await getDishDetail('RAMEN-01');
      const optId = ramen.modifierGroups?.[0]?.options?.[0]?.optionId;
      const modIds = optId ? [optId] : [];

      const first = await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: ramen.dishId, quantity: 1, modifierOptionIds: modIds },
      });
      assert.equal(first.status, 200, `Expected 200 add cart item, got ${first.status}: ${first.text}`);
      assert.equal(first.data.items.length, 1);
      assert.equal(first.data.items[0].quantity, 1);
      assert.ok(first.data.items[0].dishCode, 'CartItemDto must include dishCode');
      assert.ok('imageUrl' in first.data.items[0], 'CartItemDto must include imageUrl');

      const second = await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: ramen.dishId, quantity: 1, modifierOptionIds: modIds },
      });
      assert.equal(second.status, 200);
      assert.equal(second.data.items.length, 1, 'Identical dish + modifiers should merge');
      assert.equal(second.data.items[0].quantity, 2);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F9-02: API Get, Update Quantity, Delete Item, and Clear Cart persist in SQL', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f902' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('GYOZA-01') || snap.dishes[0];

      const added = await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 1, modifierOptionIds: [] },
      });
      assert.equal(added.status, 200);
      const cartItemId = added.data.items[0].cartItemId;

      const updated = await apiRequest(`/cart/items/${cartItemId}`, {
        method: 'PUT',
        token: disp.accessToken,
        body: { quantity: 3 },
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.data.items[0].quantity, 3);

      const getAfterUpdate = await apiRequest('/cart', { token: disp.accessToken });
      assert.equal(getAfterUpdate.status, 200);
      assert.equal(getAfterUpdate.data.totalItemCount, 3);

      const deleted = await apiRequest(`/cart/items/${cartItemId}`, {
        method: 'DELETE',
        token: disp.accessToken,
      });
      assert.equal(deleted.status, 200);
      assert.equal(deleted.data.items.length, 0);

      // Re-add then clear whole cart
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 2, modifierOptionIds: [] },
      });
      const cleared = await apiRequest('/cart', { method: 'DELETE', token: disp.accessToken });
      assert.equal(cleared.status, 200);

      const getFinal = await apiRequest('/cart', { token: disp.accessToken });
      assert.equal(getFinal.data.items.length, 0);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F9-03: UI Authenticated Add-to-Cart & CartDrawer Sync starts with 0 mock items and adds via API', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f903' });
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/menu');

        // Zero pre-seeded mock items in badge
        const cartBtn = page.getByRole('button', { name: /Giỏ hàng 0 món/i }).first();
        await cartBtn.waitFor({ state: 'visible' });

        const addPost = page.waitForResponse(
          (r) => r.url().includes('/api/cart/items') && r.request().method() === 'POST'
        );
        await page.getByRole('button', { name: 'Thêm', exact: true }).first().click();
        const addRes = await addPost;
        assert.equal(addRes.status(), 200);

        await page.getByRole('heading', { name: 'Giỏ Hàng Của Bạn' }).waitFor({ state: 'visible' });
        await page.getByRole('button', { name: /Giỏ hàng 1 món/i }).first().waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F9-04: UI Cart Persistence Across Hard Reload hydrates from SQL Server', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f904' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('SASHIMI-01') || snap.dishes[0];
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 2, modifierOptionIds: [] },
      });

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/cart');
        await page.getByRole('heading', { name: /Giỏ Hàng \(2 Món\)/i }).waitFor({ state: 'visible' });

        await page.reload({ waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: /Giỏ Hàng \(2 Món\)/i }).waitFor({ state: 'visible' });
        await page.getByText(dish.name).first().waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F9-05: UI CartPage Quantity, Remove & Clear Controls render empty state cleanly', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f905' });
    try {
      const snap = await getCatalogSnapshot();
      const d1 = snap.dishes[0];
      const d2 = snap.dishes[1];
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: d1.dishId, quantity: 1, modifierOptionIds: [] },
      });
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: d2.dishId, quantity: 1, modifierOptionIds: [] },
      });

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/cart');
        await page.getByRole('heading', { name: /Giỏ Hàng \(2 Món\)/i }).waitFor({ state: 'visible' });

        // Remove first item
        const delReq = page.waitForResponse((r) => r.url().includes('/api/cart/items/') && r.request().method() === 'DELETE');
        await page.locator('button[title="Xóa món"]').first().click();
        assert.equal((await delReq).status(), 200);
        await page.getByRole('heading', { name: /Giỏ Hàng \(1 Món\)/i }).waitFor({ state: 'visible' });

        // Clear remaining items
        const clearReq = page.waitForResponse((r) => r.url().endsWith('/api/cart') && r.request().method() === 'DELETE');
        await page.getByRole('button', { name: 'Xóa hết giỏ hàng' }).click();
        assert.equal((await clearReq).status(), 200);
        await page.getByRole('heading', { name: 'Giỏ Hàng Của Bạn Đang Trống' }).waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 1 — F10: Authenticated Order Creation & History', () => {
  it('T1-F10-01: API Create Delivery Order with String Enums returns 201 Created', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1001' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('GYOZA-01') || snap.dishes[0];
      const res = await apiRequest('/orders', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          orderType: 'Delivery',
          paymentMethod: 'FullBank',
          recipientName: disp.fullName,
          recipientPhone: '0909111222',
          deliveryAddress: '15A Lê Thánh Tôn, Quận 1, TP.HCM',
          guestCount: 1,
          notes: 'Giao giờ trưa',
          items: [{ menuItemId: dish.dishId, quantity: 2, modifierOptionIds: [] }],
        },
      });
      assert.equal(res.status, 201, `Expected 201 create order, got ${res.status}: ${res.text}`);
      assert.ok(res.data?.orderId);
      assert.ok(res.data?.orderNumber);
      assert.equal(res.data.orderType, 'Delivery');
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F10-02: API Create Order JWT UserId Enforcement sets order.userId from JWT and appears in my-history', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1002' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.dishes[0];
      const createRes = await apiRequest('/orders', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          orderType: 'Takeaway',
          paymentMethod: 'FullBank',
          guestCount: 1,
          items: [{ menuItemId: dish.dishId, quantity: 1, modifierOptionIds: [] }],
        },
      });
      assert.equal(createRes.status, 201);
      assert.equal(createRes.data.userId, disp.userId);

      const historyRes = await apiRequest('/orders/my-history?page=1&pageSize=10', { token: disp.accessToken });
      assert.equal(historyRes.status, 200);
      assert.ok(historyRes.data.items.some((o) => o.orderId === createRes.data.orderId));
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F10-03: API Get Order By ID & History Pagination returns item details and totals', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1003' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.dishes[0];
      const created = (
        await apiRequest('/orders', {
          method: 'POST',
          token: disp.accessToken,
          body: {
            orderType: 'Delivery',
            paymentMethod: 'Cod50Deposit',
            recipientName: 'E2E Test',
            recipientPhone: '0901234567',
            deliveryAddress: 'Quận 1, TP.HCM',
            items: [{ menuItemId: dish.dishId, quantity: 2, modifierOptionIds: [] }],
          },
        })
      ).data;

      const byId = await apiRequest(`/orders/${created.orderId}`, { token: disp.accessToken });
      assert.equal(byId.status, 200);
      assert.equal(byId.data.orderId, created.orderId);
      assert.ok(byId.data.items.length === 1);
      assert.ok(byId.data.totalAmount > 0);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F10-04: API Cancel Pending Order updates status to Cancelled', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1004' });
    try {
      const snap = await getCatalogSnapshot();
      const created = (
        await apiRequest('/orders', {
          method: 'POST',
          token: disp.accessToken,
          body: {
            orderType: 'Takeaway',
            paymentMethod: 'FullBank',
            items: [{ menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] }],
          },
        })
      ).data;

      const cancelRes = await apiRequest(`/orders/${created.orderId}/cancel`, {
        method: 'POST',
        token: disp.accessToken,
        body: { reason: 'Thay đổi kế hoạch E2E' },
      });
      assert.equal(cancelRes.status, 200);

      const afterGet = await apiRequest(`/orders/${created.orderId}`, { token: disp.accessToken });
      assert.equal(afterGet.status, 200);
      assert.equal(afterGet.data.status, 'Cancelled');
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F10-05: UI Checkout Order Submission calls POST /api/orders, clears cart, and renders server orderNumber', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1005' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('WAGYU-01') || snap.dishes[0];
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 1, modifierOptionIds: [] },
      });

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/cart');
        await page.getByRole('button', { name: /Tiến Hành Đặt Hàng & Thanh Toán/i }).click();
        await page.waitForURL(/\/checkout/);

        const textInputs = page.locator('form input[type="text"], form input[type="tel"]');
        await textInputs.nth(0).fill(disp.fullName);
        await textInputs.nth(1).fill('0909888777');
        await page.getByPlaceholder(/Số nhà, tên đường/i).fill('15A Lê Thánh Tôn, Quận 1, TP.HCM');

        const orderPromise = page.waitForResponse(
          (r) => r.url().includes('/api/orders') && r.request().method() === 'POST'
        );
        await page.getByRole('button', { name: /Tôi Đã Chuyển Khoản & Xác Nhận Đơn/i }).click();
        const orderRes = await orderPromise;
        assert.equal(orderRes.status(), 201, `Checkout must hit POST /api/orders -> 201, got ${orderRes.status()}`);
        const orderJson = await orderRes.json();

        await page.getByRole('heading', { name: 'Đặt Hàng Thành Công!' }).waitFor({ state: 'visible' });
        await page.getByText(orderJson.orderNumber).first().waitFor({ state: 'visible' });
      });

      const cartAfter = await apiRequest('/cart', { token: disp.accessToken });
      assert.equal(cartAfter.data.items.length, 0, 'Cart in SQL must be empty after order submission');
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 1 — F11: Strict Deposit Policy & VietQR / Gateways', () => {
  it('T1-F11-01: UI FullBank 100% VietQR Calculation uses live MB Bank config and full total', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1101' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('RAMEN-01') || snap.dishes[0];
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 2, modifierOptionIds: [] },
      });
      const expectedTotal = Math.round(Number(dish.basePrice) * 2);

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/checkout');
        await page.getByText('Số tiền thanh toán (100%):').waitFor({ state: 'visible' });
        await page.getByText(`${expectedTotal.toLocaleString('vi-VN')}₫`).first().waitFor({ state: 'visible' });

        const qrSrc = await page.locator('img[alt="VietQR Transfer"]').getAttribute('src');
        assert.ok(qrSrc && qrSrc.includes('https://img.vietqr.io/'), `Expected VietQR URL, got ${qrSrc}`);
        assert.ok(qrSrc.includes(`amount=${expectedTotal}`), `Expected amount=${expectedTotal} in ${qrSrc}`);
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F11-02: UI Cod50Deposit 50% VietQR Calculation updates QR amount to Math.round(total * 0.5)', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1102' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('WAGYU-01') || snap.dishes[0];
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 1, modifierOptionIds: [] },
      });
      const total = Math.round(Number(dish.basePrice));
      const deposit = Math.round(total * 0.5);

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/checkout');
        await page.getByText(/Ship COD \(Bắt Buộc Chuyển Khoản Cọc Trước 50%\)/i).click();

        await page.getByText('Số tiền cọc cần chuyển (50%):').waitFor({ state: 'visible' });
        await page.getByText(`${deposit.toLocaleString('vi-VN')}₫`).first().waitFor({ state: 'visible' });

        const qrSrc = await page.locator('img[alt="VietQR Transfer"]').getAttribute('src');
        assert.ok(qrSrc && qrSrc.includes(`amount=${deposit}`), `Expected amount=${deposit} in ${qrSrc}`);
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F11-03: API Order Checkout Endpoint returns VnPay paymentUrl', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1103' });
    try {
      const snap = await getCatalogSnapshot();
      const order = (
        await apiRequest('/orders', {
          method: 'POST',
          token: disp.accessToken,
          body: {
            orderType: 'Delivery',
            paymentMethod: 'FullBank',
            items: [{ menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] }],
          },
        })
      ).data;

      const checkoutRes = await apiRequest(`/orders/${order.orderId}/checkout`, {
        method: 'POST',
        token: disp.accessToken,
        body: { gateway: 'VnPay', returnUrl: '/api/payments/vnpay-return' },
      });
      assert.equal(checkoutRes.status, 200, `Expected 200 on checkout, got ${checkoutRes.status}: ${checkoutRes.text}`);
      assert.equal(checkoutRes.data.orderId, order.orderId);
      assert.equal(checkoutRes.data.gateway, 'VnPay');
      assert.ok(checkoutRes.data.paymentUrl);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F11-04: API Staff Cash Payment Confirmation completes order', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1104' });
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

      const chk = await apiRequest(`/orders/${order.orderId}/checkout`, {
        method: 'POST',
        token: disp.accessToken,
        body: { gateway: 'Cash' },
      });
      assert.equal(chk.status, 200);

      const refreshed = (await apiRequest(`/orders/${order.orderId}`, { token: disp.accessToken })).data;
      const txnNumber = refreshed.paymentTransactions?.[0]?.transactionNumber;
      assert.ok(txnNumber, 'Expected payment transaction created by checkout');

      const cashRes = await apiRequest('/payments/cash-confirm', {
        method: 'POST',
        token: staff.accessToken,
        body: { transactionNumber: txnNumber },
      });
      assert.equal(cashRes.status, 200, `Expected 200 cash-confirm, got ${cashRes.status}: ${cashRes.text}`);
      assert.equal(cashRes.data.success, true);

      const finalOrder = (await apiRequest(`/orders/${order.orderId}`, { token: disp.accessToken })).data;
      assert.equal(finalOrder.status, 'Completed');
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F11-05: UI VietQR Copy Buttons & Live Bank Info match GET /api/restaurant-info', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1105' });
    try {
      const infoRes = await apiRequest('/restaurant-info');
      assert.equal(infoRes.status, 200);
      const bankAccount = infoRes.data.accountNumber;
      assert.ok(bankAccount, 'Expected accountNumber from /api/restaurant-info');

      const snap = await getCatalogSnapshot();
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
      });

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/checkout');
        await page.getByText(bankAccount).waitFor({ state: 'visible' });
        await page.locator('button[title="Sao chép"]').first().click();
        await page.getByText('Đã sao chép vào bộ nhớ tạm!').waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 1 — F12: Vouchers', () => {
  it('T1-F12-01: API Public Voucher Listing returns active seeded vouchers', async () => {
    const res = await apiRequest('/vouchers');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    const codes = res.data.map((v) => v.code || v.voucherCode);
    for (const expected of ['JAPANFOOD50K', 'KAISEKI10', 'WAGYU50K', 'SAKURA15']) {
      assert.ok(codes.includes(expected), `Missing public seeded voucher ${expected}`);
    }
  });

  it('T1-F12-02: API Apply Fixed-Amount Voucher JAPANFOOD50K returns 50,000 discount', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1202' });
    try {
      const res = await apiRequest('/vouchers/apply', {
        method: 'POST',
        token: disp.accessToken,
        body: { code: 'JAPANFOOD50K', currentSubtotal: 250000 },
      });
      assert.equal(res.status, 200, `Expected 200 on valid voucher, got ${res.status}: ${res.text}`);
      assert.equal(res.data.isValid, true);
      assert.equal(res.data.discountAmount, 50000);
      assert.equal(res.data.finalTotal, 200000);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F12-03: API Apply Percentage Voucher KAISEKI10 caps discount at 100,000', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1203' });
    try {
      const res = await apiRequest('/vouchers/apply', {
        method: 'POST',
        token: disp.accessToken,
        body: { code: 'KAISEKI10', currentSubtotal: 1500000 },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.isValid, true);
      assert.equal(res.data.discountAmount, 100000);
      assert.equal(res.data.finalTotal, 1400000);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F12-04: API Order Completion with Voucher RecordUsage Bug Fix passes when subTotal >= minOrderAmount', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1204' });
    const staff = await getCachedSession('staff');
    try {
      const snap = await getCatalogSnapshot();
      const wagyu = snap.byCode.get('WAGYU-01') || snap.dishes.find((d) => d.basePrice >= 200000);
      const orderRes = await apiRequest('/orders', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          orderType: 'Delivery',
          paymentMethod: 'FullBank',
          voucherCode: 'JAPANFOOD50K',
          items: [{ menuItemId: wagyu.dishId, quantity: 1, modifierOptionIds: [] }],
        },
      });
      assert.equal(orderRes.status, 201, `Order creation with voucher failed: ${orderRes.text}`);
      const orderId = orderRes.data.orderId;

      await apiRequest(`/orders/${orderId}/checkout`, {
        method: 'POST',
        token: disp.accessToken,
        body: { gateway: 'Cash' },
      });
      const detail = (await apiRequest(`/orders/${orderId}`, { token: disp.accessToken })).data;
      const txn = detail.paymentTransactions[0].transactionNumber;

      const confirm = await apiRequest('/payments/cash-confirm', {
        method: 'POST',
        token: staff.accessToken,
        body: { transactionNumber: txn },
      });
      assert.equal(confirm.status, 200, `Payment completion with voucher RecordUsage failed: ${confirm.text}`);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F12-05: UI Apply Voucher on CartPage & Carry discounted total to CheckoutPage', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1205' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('WAGYU-01') || snap.dishes.find((d) => d.basePrice >= 250000);
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 1, modifierOptionIds: [] },
      });
      const expectedAfterDiscount = Math.max(0, Math.round(Number(dish.basePrice) - 50000));

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/cart');
        await page.locator('input[type="text"]').first().fill('JAPANFOOD50K');

        const applyPromise = page.waitForResponse((r) => r.url().includes('/api/vouchers/apply'));
        await page.getByRole('button', { name: 'Áp Dụng' }).click();
        assert.equal((await applyPromise).status(), 200);

        await page.getByText(/Đã áp dụng mã JAPANFOOD50K/i).waitFor({ state: 'visible' });
        await page.getByText(`${expectedAfterDiscount.toLocaleString('vi-VN')}₫`).first().waitFor({ state: 'visible' });

        await page.getByRole('button', { name: /Tiến Hành Đặt Hàng & Thanh Toán/i }).click();
        await page.waitForURL(/\/checkout/);

        const qrSrc = await page.locator('img[alt="VietQR Transfer"]').getAttribute('src');
        assert.ok(
          qrSrc && qrSrc.includes(`amount=${expectedAfterDiscount}`),
          `Discounted total ${expectedAfterDiscount} should carry over to Checkout VietQR: ${qrSrc}`
        );
      });
    } finally {
      disp.cleanup();
    }
  });
});
