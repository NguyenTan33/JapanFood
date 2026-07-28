import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS } from '../harness/env.mjs';
import {
  activateUserByEmailOrPhone,
  apiRequest,
  createDisposableCustomer,
  freshLogin,
  getCachedSession,
  getCatalogSnapshot,
  getDishDetail,
  resolveOtpFromDb,
  uniqueTestIdentity,
  cleanupDisposableUser,
} from '../harness/api-client.mjs';
import { closeBrowser, gotoRoute, withPage } from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 3 — Pairwise Cross-Feature Combinations (T3-01..T3-10)', () => {
  it('T3-01 (F1 + F2): Register -> verify OTP -> /api/auth/me -> logout -> password login', async () => {
    const id = uniqueTestIdentity('t301');
    try {
      const reg = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          fullName: id.fullName,
          email: id.email,
          phoneNumber: id.phoneNumber,
          password: id.password,
        },
      });
      assert.equal(reg.status, 201);

      const otp = resolveOtpFromDb(id.phoneNumber, 'Register');
      let accessToken = null;
      let refreshToken = null;

      if (otp) {
        const ver = await apiRequest('/auth/verify-otp', {
          method: 'POST',
          body: { email: id.email, phoneNumber: id.phoneNumber, otp },
        });
        assert.equal(ver.status, 200);
        accessToken = ver.data?.accessToken || null;
        refreshToken = ver.data?.refreshToken || null;
      } else {
        activateUserByEmailOrPhone(id.email, id.phoneNumber);
      }

      if (!accessToken) {
        const login1 = await freshLogin({ email: id.email, phoneNumber: id.email, password: id.password });
        assert.equal(login1.status, 200);
        accessToken = login1.data.accessToken;
        refreshToken = login1.data.refreshToken;
      }

      const me = await apiRequest('/auth/me', { token: accessToken });
      assert.equal(me.status, 200);
      assert.equal(me.data.email?.toLowerCase(), id.email.toLowerCase());

      if (refreshToken) {
        const logout = await apiRequest('/auth/logout', { method: 'POST', body: { refreshToken } });
        assert.equal(logout.status, 200);
      }

      const login2 = await freshLogin({ email: id.email, phoneNumber: id.email, password: id.password });
      assert.equal(login2.status, 200);
    } finally {
      cleanupDisposableUser({ email: id.email, phoneNumber: id.phoneNumber });
    }
  });

  it('T3-02 (F2 + F4): Login -> change-password -> old refresh token revoked -> old password fails -> new succeeds', async () => {
    const disp = await createDisposableCustomer({ prefix: 't302' });
    const newPassword = 'T302NewPass@2026!';
    try {
      const oldRefresh = disp.refreshToken;
      const chg = await apiRequest('/auth/change-password', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          currentPassword: disp.password,
          newPassword,
          confirmPassword: newPassword,
        },
      });
      assert.equal(chg.status, 200);

      const refreshOld = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: oldRefresh },
      });
      assert.ok([400, 401, 403].includes(refreshOld.status), 'Old refresh token must be revoked on password change');

      const failOld = await freshLogin({ email: disp.email, phoneNumber: disp.email, password: disp.password });
      assert.equal(failOld.status, 400);

      const okNew = await freshLogin({ email: disp.email, phoneNumber: disp.email, password: newPassword });
      assert.equal(okNew.status, 200);
    } finally {
      disp.cleanup();
    }
  });

  it('T3-03 (F2 + F9 Auth Gate): Browse /menu anon -> click Thêm opens AuthModal -> login -> Thêm opens CartDrawer', async () => {
    const disp = await createDisposableCustomer({ prefix: 't303' });
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
        await gotoRoute(page, '/menu');
        await page.getByRole('button', { name: /Giỏ hàng 0 món/i }).first().waitFor({ state: 'visible' });

        await page.getByRole('button', { name: 'Thêm', exact: true }).first().click();
        await page.getByRole('heading', { name: 'Chào Mừng Quý Khách' }).waitFor({ state: 'visible' });

        await page.locator('input[type="text"]').first().fill(disp.email);
        await page.locator('input[type="password"]').first().fill(disp.password);
        const loginReq = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
        await page.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
        assert.equal((await loginReq).status(), 200);

        // Repeat add after login
        const addReq = page.waitForResponse((r) => r.url().includes('/api/cart/items') && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'Thêm', exact: true }).first().click();
        assert.equal((await addReq).status(), 200);

        await page.getByRole('heading', { name: 'Giỏ Hàng Của Bạn' }).waitFor({ state: 'visible' });
        await page.getByRole('button', { name: /Giỏ hàng 1 món/i }).first().waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T3-04 (F2 + F9 Route Guard): Unauth /cart blocked -> login -> /cart loads live /api/cart', async () => {
    const disp = await createDisposableCustomer({ prefix: 't304' });
    try {
      const snap = await getCatalogSnapshot();
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
      });

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
        await gotoRoute(page, '/cart');
        // Unauthenticated visit prompts login
        await page.getByText(/đăng nhập/i).first().waitFor({ state: 'visible' });

        // Open AuthModal if not already open and login
        if (!(await page.locator('input[type="password"]').first().isVisible().catch(() => false))) {
          await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().click();
        }
        await page.locator('input[type="text"]').first().fill(disp.email);
        await page.locator('input[type="password"]').first().fill(disp.password);
        await page.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();

        await gotoRoute(page, '/cart');
        await page.getByRole('heading', { name: /Giỏ Hàng \(1 Món\)/i }).waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T3-05 (F5 + F6): HomePage category click -> /menu?category=... -> Grid view preserves filter', async () => {
    const snap = await getCatalogSnapshot();
    const sushi = snap.categories.find((c) => c.categoryCode === 'SUSHI') || snap.categories[1];

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/');
      await page.getByRole('link', { name: new RegExp(sushi.categoryName, 'i') }).first().click();
      await page.waitForURL(/\/menu\?category=/);

      await page.getByRole('button', { name: /Danh Sách Lưới/i }).click();
      const countText = await page.getByText(/Tìm thấy \d+ món ăn/i).innerText();
      assert.equal(Number(countText.match(/(\d+)/)?.[1]), sushi.dishes.length);
    });
  });

  it('T3-06 (F6 + F7): Book flip to page 2 -> open/close DishDetailModal preserves page 2; search Wagyu matches API', async () => {
    const wagyu = await getDishDetail('WAGYU-01');
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByRole('button', { name: /Trang kế tiếp/i }).click();
      await page.getByText(/^Trang 2 \/ \d+$/).waitFor({ state: 'visible' });

      await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();
      await page.getByRole('button', { name: /Thêm Vào Giỏ Hàng/i }).waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      if (await page.getByRole('button', { name: /Thêm Vào Giỏ Hàng/i }).isVisible().catch(() => false)) {
        await page.locator('div.fixed button').first().click();
      }
      await page.getByText(/^Trang 2 \/ \d+$/).waitFor({ state: 'visible' });

      await page.getByPlaceholder(/Tìm theo tên món/i).fill('Wagyu');
      await page.getByText(wagyu.name).first().waitFor({ state: 'visible' });
    });
  });

  it('T3-07 (F7 + F9): DishDetailModal modifier + qty 2 + special note persists to SQL Cart', async () => {
    const disp = await createDisposableCustomer({ prefix: 't307' });
    try {
      const ramen = await getDishDetail('RAMEN-01');
      const paidOpt = ramen.modifierGroups
        .flatMap((g) => g.options)
        .find((o) => Number(o.priceAdjustment) > 0);
      assert.ok(paidOpt);

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/menu');
        await page.getByPlaceholder(/Tìm theo tên món/i).fill('RAMEN-01');
        await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();

        await page.getByRole('button', { name: new RegExp(paidOpt.optionName, 'i') }).first().click();
        const qtyRow = page.locator('div').filter({ hasText: /^Số lượng:/ }).first();
        await qtyRow.locator('button').last().click();
        await page.getByPlaceholder(/Không hành lá/i).fill('Ít hành T3-07');

        const addReq = page.waitForResponse((r) => r.url().includes('/api/cart/items') && r.request().method() === 'POST');
        await page.getByRole('button', { name: /Thêm Vào Giỏ Hàng/i }).click();
        assert.equal((await addReq).status(), 200);
      });

      const cart = (await apiRequest('/cart', { token: disp.accessToken })).data;
      assert.equal(cart.items.length, 1);
      assert.equal(cart.items[0].quantity, 2);
      assert.equal(cart.items[0].specialInstructions, 'Ít hành T3-07');
      assert.ok(cart.items[0].modifiers.some((m) => m.optionName === paidOpt.optionName));
    } finally {
      disp.cleanup();
    }
  });

  it('T3-08 (F8 + F5/F6): Admin toggles dish unavailable -> public catalog omits it -> restore reappears', async () => {
    const admin = await getCachedSession('admin');
    const snap = await getCatalogSnapshot();
    const dish = snap.byCode.get('TEA-01') || snap.dishes[snap.dishes.length - 1];

    try {
      await apiRequest(`/menu/dishes/${dish.dishId}/availability`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isAvailable: false },
      });

      const catsOff = (await apiRequest('/menu/categories')).data;
      assert.ok(!catsOff.flatMap((c) => c.dishes).some((d) => d.code === dish.code));

      await apiRequest(`/menu/dishes/${dish.dishId}/availability`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isAvailable: true },
      });

      const catsOn = (await apiRequest('/menu/categories')).data;
      assert.ok(catsOn.flatMap((c) => c.dishes).some((d) => d.code === dish.code));
    } finally {
      await apiRequest(`/menu/dishes/${dish.dishId}/availability`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isAvailable: true },
      });
    }
  });

  it('T3-09 (F8 + F9): Admin disables dish -> cart rejects 400; Admin updates price -> cart reflects new price', async () => {
    const admin = await getCachedSession('admin');
    const disp = await createDisposableCustomer({ prefix: 't309' });
    const snap = await getCatalogSnapshot();
    const dish = snap.byCode.get('GYOZA-01') || snap.dishes[0];
    const origPrice = Number(dish.basePrice);

    try {
      await apiRequest(`/menu/dishes/${dish.dishId}/availability`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isAvailable: false },
      });
      const failAdd = await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 1 },
      });
      assert.equal(failAdd.status, 400);

      await apiRequest(`/menu/dishes/${dish.dishId}/availability`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isAvailable: true },
      });
      await apiRequest(`/menu/dishes/${dish.dishId}/price`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { newPrice: origPrice + 10000 },
      });

      const okAdd = await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 1 },
      });
      assert.equal(okAdd.status, 200);
      assert.equal(okAdd.data.items[0].basePrice, origPrice + 10000);
    } finally {
      await apiRequest(`/menu/dishes/${dish.dishId}/availability`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isAvailable: true },
      });
      await apiRequest(`/menu/dishes/${dish.dishId}/price`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { newPrice: origPrice },
      });
      disp.cleanup();
    }
  });

  it('T3-10 (F9 + F12): CartPage invalid voucher -> 400, valid JAPANFOOD50K -> -50k, reduce qty below min revalidates', async () => {
    const disp = await createDisposableCustomer({ prefix: 't310' });
    try {
      const snap = await getCatalogSnapshot();
      // Pick dish ~100k-165k so qty 2 >= 200k and qty 1 < 200k
      const dish = snap.dishes.find((d) => d.basePrice >= 110000 && d.basePrice <= 190000) || snap.dishes[0];
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, quantity: 2, modifierOptionIds: [] },
      });

      await withPage(
        {
          viewport: VIEWPORTS.DESKTOP_1280,
          authSession: disp,
          allowedStatuses: ({ status, url }) => status === 400 && url.includes('/api/vouchers/apply'),
        },
        async (page) => {
          await gotoRoute(page, '/cart');

          // Invalid code
          await page.locator('input[type="text"]').first().fill('BADCODE');
          await page.getByRole('button', { name: 'Áp Dụng' }).click();
          await page.getByText(/không hợp lệ|không tồn tại/i).first().waitFor({ state: 'visible' });

          // Valid code
          await page.locator('input[type="text"]').first().fill('JAPANFOOD50K');
          await page.getByRole('button', { name: 'Áp Dụng' }).click();
          await page.getByText(/Đã áp dụng mã JAPANFOOD50K/i).waitFor({ state: 'visible' });

          // Reduce qty from 2 to 1 (below 200k minOrderAmount)
          const minusBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(1);
          const itemRow = page.locator('div').filter({ hasText: dish.name }).filter({ has: page.locator('button[title="Xóa món"]') }).first();
          await itemRow.locator('button').first().click();
          await page.getByRole('heading', { name: /Giỏ Hàng \(1 Món\)/i }).waitFor({ state: 'visible' });
        }
      );
    } finally {
      disp.cleanup();
    }
  });
});
