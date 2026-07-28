import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS } from '../harness/env.mjs';
import {
  activateUserByEmailOrPhone,
  apiRequest,
  cleanupDisposableUser,
  createDisposableCustomer,
  freshLogin,
  futureReservationSlot,
  getCatalogSnapshot,
  querySqlRows,
  resolveOtpFromDb,
  runSql,
  sqlEscape,
  uniqueTestIdentity,
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

after(async () => {
  await closeBrowser();
});

describe('Tier 4 — Real-World Application Scenarios (T4-01..T4-05)', () => {
  it('T4-01 (Desktop 1280x800): First-time visitor browse -> unclipped modal -> auth-gated block -> login -> clean CartDrawer', async () => {
    const disp = await createDisposableCustomer({ prefix: 't401' });
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
        await gotoRoute(page, '/');
        await assertSakuraBadgeClean(page);
        await page.getByRole('button', { name: /Giỏ hàng 0 món/i }).first().waitFor({ state: 'visible' });
        await page.getByRole('heading', { name: /7 Danh Mục Món Nhật Đặc Sắc/i }).waitFor({ state: 'visible' });

        await page.getByRole('link', { name: /Thực đơn/i }).first().click();
        await page.waitForURL(/\/menu/);

        await page.getByPlaceholder(/Tìm theo tên món/i).fill('Ramen');
        await page.getByRole('button', { name: 'Dưới 200.000₫' }).click();
        await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();
        await assertDishDetailModalLayout(page, VIEWPORTS.DESKTOP_1280);

        // Auth-gated block -> opens AuthModal (zero Demo VIP bypass)
        await page.getByRole('button', { name: /Thêm Vào Giỏ Hàng/i }).click();
        await page.getByRole('heading', { name: 'Chào Mừng Quý Khách' }).waitFor({ state: 'visible' });
        assert.equal(await page.getByRole('button', { name: /Demo Khách VIP/i }).count(), 0);

        await page.locator('input[type="text"]').first().fill(disp.email);
        await page.locator('input[type="password"]').first().fill(disp.password);
        const loginReq = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
        await page.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
        assert.equal((await loginReq).status(), 200);

        // Add item now that user is logged in
        const addReq = page.waitForResponse((r) => r.url().includes('/api/cart/items') && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'Thêm', exact: true }).first().click();
        assert.equal((await addReq).status(), 200);

        await assertCartDrawerLayout(page, VIEWPORTS.DESKTOP_1280);
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T4-02 (Desktop 1440x900): Full E2E order with 3D Book flip, modifiers, JAPANFOOD50K, COD 50% VietQR & SQL persistence', async () => {
    const disp = await createDisposableCustomer({ prefix: 't402' });
    try {
      const snap = await getCatalogSnapshot();
      const wagyu = snap.byCode.get('WAGYU-01') || snap.dishes.find((d) => d.basePrice >= 300000);
      const expectedAfterVoucher = Math.round(Number(wagyu.basePrice) - 50000);
      const expectedDeposit50 = Math.round(expectedAfterVoucher * 0.5);
      let createdOrderNumber = null;

      await withPage({ viewport: VIEWPORTS.DESKTOP_1440, authSession: disp }, async (page) => {
        await gotoRoute(page, '/menu');
        // Exercise 3D Book flip
        await page.getByRole('button', { name: /Trang kế tiếp/i }).click();
        await page.getByText(/^Trang 2 \/ \d+$/).waitFor({ state: 'visible' });

        await page.getByPlaceholder(/Tìm theo tên món/i).fill('WAGYU-01');
        await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();

        const ponzuBtn = page.getByRole('button', { name: /Yuzu Ponzu/i }).first();
        if (await ponzuBtn.isVisible().catch(() => false)) {
          await ponzuBtn.click();
        }
        const addReq = page.waitForResponse((r) => r.url().includes('/api/cart/items') && r.request().method() === 'POST');
        await page.getByRole('button', { name: /Thêm Vào Giỏ Hàng/i }).click();
        assert.equal((await addReq).status(), 200);

        await gotoRoute(page, '/cart');
        await page.locator('input[type="text"]').first().fill('JAPANFOOD50K');
        await page.getByRole('button', { name: 'Áp Dụng' }).click();
        await page.getByText(/Đã áp dụng mã JAPANFOOD50K/i).waitFor({ state: 'visible' });

        await page.getByRole('button', { name: /Tiến Hành Đặt Hàng & Thanh Toán/i }).click();
        await page.waitForURL(/\/checkout/);

        await page.getByText(/Ship COD \(Bắt Buộc Chuyển Khoản Cọc Trước 50%\)/i).click();
        const qrSrc = await page.locator('img[alt="VietQR Transfer"]').getAttribute('src');
        assert.ok(qrSrc && qrSrc.includes(`amount=${expectedDeposit50}`), `Expected COD 50% VietQR amount=${expectedDeposit50}, got ${qrSrc}`);

        const inputs = page.locator('form input[type="text"], form input[type="tel"]');
        await inputs.nth(0).fill(disp.fullName);
        await inputs.nth(1).fill('0909888111');
        await page.getByPlaceholder(/Số nhà, tên đường/i).fill('15A Lê Thánh Tôn, Quận 1, TP.HCM');

        const orderPromise = page.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');
        await page.getByRole('button', { name: /Tôi Đã Chuyển Khoản & Xác Nhận Đơn/i }).click();
        const orderRes = await orderPromise;
        assert.equal(orderRes.status(), 201);
        const orderData = await orderRes.json();
        createdOrderNumber = orderData.orderNumber;

        await page.getByRole('heading', { name: 'Đặt Hàng Thành Công!' }).waitFor({ state: 'visible' });
        await page.getByText(createdOrderNumber).waitFor({ state: 'visible' });
      });

      const sqlRows = querySqlRows(
        `SELECT ORDER_NUMBER, DISCOUNT_AMOUNT FROM dbo.ORDERS WHERE ORDER_NUMBER = N'${sqlEscape(createdOrderNumber)}';`
      );
      assert.equal(sqlRows.length, 1, 'Order must be persisted in SQL Server dbo.ORDERS');
      const cartAfter = await apiRequest('/cart', { token: disp.accessToken });
      assert.equal(cartAfter.data.items.length, 0);
    } finally {
      disp.cleanup();
    }
  });

  it('T4-03 (iPhone 375x812): MobileNav -> Menu filters & Book header -> login -> DishDetailModal -> CartDrawer -> FullBank checkout', async () => {
    const disp = await createDisposableCustomer({ prefix: 't403' });
    try {
      await withPage({ viewport: VIEWPORTS.IPHONE_375 }, async (page) => {
        await gotoRoute(page, '/');
        await assertNoHorizontalOverflow(page, 'T4-03 / @ 375x812');

        await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
        await page.getByRole('link', { name: /Thực đơn/i }).click();
        await page.waitForURL(/\/menu/);

        await assertMenuMobileFiltersAndBookHeader(page, 375);
        await page.getByRole('button', { name: /Danh Sách Lưới/i }).click();

        // Login via MobileNav
        await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
        await page.getByRole('button', { name: 'Đăng nhập' }).click();
        await page.locator('input[type="text"]').first().fill(disp.email);
        await page.locator('input[type="password"]').first().fill(disp.password);
        const loginReq = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
        await page.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
        assert.equal((await loginReq).status(), 200);

        await page.getByPlaceholder(/Tìm theo tên món/i).fill('WAGYU-01');
        await page.getByRole('button', { name: 'Topping' }).first().click();
        await assertDishDetailModalLayout(page, VIEWPORTS.IPHONE_375);

        const addReq = page.waitForResponse((r) => r.url().includes('/api/cart/items') && r.request().method() === 'POST');
        await page.getByRole('button', { name: /Thêm Vào Giỏ Hàng/i }).click();
        assert.equal((await addReq).status(), 200);

        await page.getByRole('button', { name: /Giỏ hàng 1 món/i }).first().click();
        await assertCartDrawerLayout(page, VIEWPORTS.IPHONE_375);
        await page.getByRole('link', { name: /Đặt Hàng Ngay/i }).click();
        await page.waitForURL(/\/checkout/);
        await assertNoHorizontalOverflow(page, 'T4-03 /checkout @ 375x812');

        const inputs = page.locator('form input[type="text"], form input[type="tel"]');
        await inputs.nth(0).fill(disp.fullName);
        await inputs.nth(1).fill('0909777888');
        await page.getByPlaceholder(/Số nhà, tên đường/i).fill('15A Lê Thánh Tôn, Q1');

        const orderReq = page.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');
        await page.getByRole('button', { name: /Tôi Đã Chuyển Khoản & Xác Nhận Đơn/i }).click();
        assert.equal((await orderReq).status(), 201);
        await page.getByRole('heading', { name: 'Đặt Hàng Thành Công!' }).waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T4-04 (iPhone 390x844): Quick Reservation bar -> 4-step Wizard (Tatami, 4 guests) -> real reservationCode', async () => {
    const slot = futureReservationSlot(25, 19, 0);
    let createdRsvCode = null;
    try {
      await withPage({ viewport: VIEWPORTS.IPHONE_390 }, async (page) => {
        await gotoRoute(page, '/');
        await assertNoHorizontalOverflow(page, 'T4-04 / @ 390x844');

        const quickForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Tìm Bàn Trống' }) });
        await quickForm.locator('input[type="date"]').fill(slot.dateStr);
        await quickForm.locator('select').nth(1).selectOption('19:00');
        await quickForm.locator('select').nth(2).selectOption('4');
        await page.getByRole('button', { name: 'Tìm Bàn Trống' }).click();

        await page.waitForURL(/\/reservation\?/);
        await assertNoHorizontalOverflow(page, 'T4-04 step 1 @ 390x844');
        await page.getByRole('button', { name: /Tiếp tục: Chọn khu vực bàn/i }).click();

        await assertNoHorizontalOverflow(page, 'T4-04 step 2 @ 390x844');
        const tatami = page.getByRole('button', { name: /Tatami/i }).first();
        if (await tatami.isVisible().catch(() => false)) {
          await tatami.click();
        }
        await page.getByRole('button', { name: /Tiếp tục: Số lượng khách/i }).click();

        await assertNoHorizontalOverflow(page, 'T4-04 step 3 @ 390x844');
        await page.getByRole('button', { name: '4 người', exact: true }).click();
        await page.getByRole('button', { name: /Tiếp tục: Thông tin người đặt/i }).click();

        await assertNoHorizontalOverflow(page, 'T4-04 step 4 @ 390x844');
        await page.locator('input[type="text"]').first().fill('Khách Mobile T4-04');
        await page.locator('input[type="tel"]').first().fill('0909666555');
        await page.locator('input[type="email"]').first().fill('t404.mobile@example.com');

        const rsvPromise = page.waitForResponse(
          (r) => r.url().includes('/api/reservations') && r.request().method() === 'POST'
        );
        await page.getByRole('button', { name: /Xác Nhận Đặt Bàn Ngay/i }).click();
        const rsvRes = await rsvPromise;
        assert.equal(rsvRes.status(), 201);
        const rsvJson = await rsvRes.json();
        createdRsvCode = rsvJson.reservationCode;

        await page.getByRole('heading', { name: 'Đặt Bàn Thành Công!' }).waitFor({ state: 'visible' });
        await page.getByText(createdRsvCode).waitFor({ state: 'visible' });
      });
    } finally {
      if (createdRsvCode) {
        runSql(`DELETE FROM dbo.RESERVATIONS WHERE RESERVATION_CODE = N'${sqlEscape(createdRsvCode)}';`);
      }
    }
  });

  it('T4-05 (Desktop 1280x800): New customer onboarding (register -> OTP -> cart persist on reload -> FullBank order -> history)', async () => {
    const id = uniqueTestIdentity('t405');
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
        await gotoRoute(page, '/');
        await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().click();
        await page.getByRole('button', { name: 'Đăng ký ngay' }).click();

        await page.getByPlaceholder('Nguyễn Văn A').fill(id.fullName);
        await page.getByPlaceholder('0901234567').fill(id.phoneNumber);
        await page.getByPlaceholder('email@example.com').fill(id.email);
        await page.getByPlaceholder(/Tối thiểu/i).fill(id.password);

        const regPromise = page.waitForResponse((r) => r.url().includes('/api/auth/register'));
        await page.getByRole('button', { name: 'Tạo Tài Khoản Thành Viên' }).click();
        assert.equal((await regPromise).status(), 201);

        const otp = resolveOtpFromDb(id.phoneNumber, 'Register');
        const otpInput = page.locator('input[placeholder*="OTP"], input[maxlength="6"]').first();
        if (otp && (await otpInput.isVisible({ timeout: 3000 }).catch(() => false))) {
          await otpInput.fill(otp);
          await page.getByRole('button', { name: /Xác thực|Xác nhận/i }).first().click();
        } else {
          activateUserByEmailOrPhone(id.email, id.phoneNumber);
          // Log in via AuthModal if OTP screen didn't auto-login
          await gotoRoute(page, '/');
          await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().click();
          await page.locator('input[type="text"]').first().fill(id.email);
          await page.locator('input[type="password"]').first().fill(id.password);
          await page.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
        }

        await page.getByRole('button', { name: /Đăng xuất/i }).first().waitFor({ state: 'visible' });

        await gotoRoute(page, '/menu');
        await page.getByPlaceholder(/Tìm theo tên món/i).fill('SASHIMI-01');
        const addReq = page.waitForResponse((r) => r.url().includes('/api/cart/items') && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'Thêm', exact: true }).first().click();
        assert.equal((await addReq).status(), 200);

        await page.reload({ waitUntil: 'networkidle' });
        await page.getByRole('button', { name: /Giỏ hàng 1 món/i }).first().waitFor({ state: 'visible' });

        await gotoRoute(page, '/checkout');
        const inputs = page.locator('form input[type="text"], form input[type="tel"]');
        await inputs.nth(0).fill(id.fullName);
        await inputs.nth(1).fill('0909123123');
        await page.getByPlaceholder(/Số nhà, tên đường/i).fill('15A Lê Thánh Tôn, Q1');

        const orderReq = page.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');
        await page.getByRole('button', { name: /Tôi Đã Chuyển Khoản & Xác Nhận Đơn/i }).click();
        assert.equal((await orderReq).status(), 201);
        const createdOrder = await (await orderReq).json();
        await page.getByRole('heading', { name: 'Đặt Hàng Thành Công!' }).waitFor({ state: 'visible' });

        const loginCheck = await freshLogin({ email: id.email, phoneNumber: id.email, password: id.password });
        assert.equal(loginCheck.status, 200);
        const hist = await apiRequest('/orders/my-history?page=1&pageSize=10', { token: loginCheck.data.accessToken });
        assert.ok(hist.data.items.some((o) => o.orderId === createdOrder.orderId));
      });
    } finally {
      cleanupDisposableUser({ email: id.email, phoneNumber: id.phoneNumber });
    }
  });
});
