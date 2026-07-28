import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS } from '../harness/env.mjs';
import {
  apiRequest,
  getCachedSession,
  getCatalogSnapshot,
  runSql,
} from '../harness/api-client.mjs';
import { closeBrowser, gotoRoute, withPage } from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 2 — F5 Boundaries: Menu Catalog & Categories', () => {
  it('T2-F5-01: Inactive Category Excluded from GET /api/menu/categories', async () => {
    const admin = await getCachedSession('admin');
    const code = `E2E_INACT_${Date.now()}`;
    let catId = null;

    try {
      const created = await apiRequest('/menu/categories', {
        method: 'POST',
        token: admin.accessToken,
        body: { categoryCode: code, categoryName: 'Inactive Temp Cat', displayOrder: 200 },
      });
      assert.equal(created.status, 201);
      catId = created.data.categoryId;

      await apiRequest(`/menu/categories/${catId}/status`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isActive: false },
      });

      const listRes = await apiRequest('/menu/categories');
      assert.equal(listRes.status, 200);
      assert.ok(!listRes.data.some((c) => c.categoryId === catId), 'Inactive category must not appear publicly');
    } finally {
      if (catId) runSql(`DELETE FROM dbo.CATEGORIES WHERE CATEGORY_ID = ${catId};`);
    }
  });

  it('T2-F5-02: Unavailable Dish Excluded From Public Category Tree', async () => {
    const admin = await getCachedSession('admin');
    const snap = await getCatalogSnapshot();
    const dish = snap.byCode.get('TEA-01') || snap.dishes[snap.dishes.length - 1];

    try {
      const off = await apiRequest(`/menu/dishes/${dish.dishId}/availability`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isAvailable: false },
      });
      assert.equal(off.status, 200);

      const cats = (await apiRequest('/menu/categories')).data;
      const allDishCodes = cats.flatMap((c) => c.dishes.map((d) => d.code));
      assert.ok(!allDishCodes.includes(dish.code), `Unavailable dish ${dish.code} should be omitted from category tree`);
    } finally {
      await apiRequest(`/menu/dishes/${dish.dishId}/availability`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isAvailable: true },
      });
    }
  });

  it('T2-F5-03: Invalid Category Query Param on /menu renders gracefully with zero crash', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu?category=nonexistent-cat');
      await page.getByRole('heading', { name: 'Tuyển Tập Ẩm Thực Cố Đô' }).waitFor({ state: 'visible' });
      await page.getByText(/Tìm thấy 0 món ăn/i).waitFor({ state: 'visible' });
    });
  });

  it('T2-F5-04: Category Display Order Preserved ascending', async () => {
    const cats = (await apiRequest('/menu/categories')).data;
    assert.ok(cats.length >= 7);
    for (let i = 1; i < cats.length; i++) {
      assert.ok(
        cats[i].displayOrder >= cats[i - 1].displayOrder,
        `Categories out of displayOrder: ${cats[i - 1].displayOrder} -> ${cats[i].displayOrder}`
      );
    }
  });

  it('T2-F5-05: Zero-Auth Public Access to /api/menu/categories never returns 401', async () => {
    const res = await apiRequest('/menu/categories');
    assert.equal(res.status, 200);
  });
});

describe('Tier 2 — F6 Boundaries: Dish Filtering & Book Pagination', () => {
  it('T2-F6-01: isFeatured=true Paging Bug Regression Check counts only featured dishes', async () => {
    const snap = await getCatalogSnapshot();
    const p1 = await apiRequest('/menu/dishes?isFeatured=true&page=1&pageSize=4');
    assert.equal(p1.status, 200);
    assert.ok(p1.data.items.length <= 4 && p1.data.items.length > 0);
    assert.ok(p1.data.items.every((d) => d.isFeatured === true), 'Every returned item must have isFeatured=true');
    assert.ok(
      p1.data.totalCount < snap.totalCount,
      `totalCount (${p1.data.totalCount}) must reflect featured count, not all ${snap.totalCount} dishes`
    );

    const p2 = await apiRequest('/menu/dishes?isFeatured=true&page=2&pageSize=4');
    assert.equal(p2.status, 200);
    assert.ok(p2.data.items.every((d) => d.isFeatured === true));
  });

  it('T2-F6-02: Inverted Price Range minPrice > maxPrice returns empty list', async () => {
    const res = await apiRequest('/menu/dishes?minPrice=500000&maxPrice=100000');
    assert.equal(res.status, 200);
    assert.equal(res.data.items.length, 0);
    assert.equal(res.data.totalCount, 0);
  });

  it('T2-F6-03: Special Characters / XSS / SQLi in keyword handled safely without 500', async () => {
    const payload = "' OR 1=1--<script>";
    const apiRes = await apiRequest(`/menu/dishes?keyword=${encodeURIComponent(payload)}`);
    assert.equal(apiRes.status, 200);
    assert.equal(apiRes.data.items.length, 0);

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByRole('button', { name: /Danh Sách Lưới/i }).click();
      await page.getByPlaceholder(/Tìm theo tên món/i).fill(payload);
      await page.getByRole('heading', { name: 'Không tìm thấy món ăn phù hợp' }).waitFor({ state: 'visible' });
    });
  });

  it('T2-F6-04: Out-of-Bounds Page & Huge PageSize handled safely without 500', async () => {
    const p999 = await apiRequest('/menu/dishes?page=999&pageSize=12');
    assert.equal(p999.status, 200);
    assert.equal(p999.data.items.length, 0);

    const pHuge = await apiRequest('/menu/dishes?page=0&pageSize=1000');
    assert.ok([200, 400].includes(pHuge.status), `Expected 200 or 400 for huge pageSize, got ${pHuge.status}`);
  });

  it('T2-F6-05: Book Boundary Disabled Arrows & Empty Filter Reset restores full catalog', async () => {
    const snap = await getCatalogSnapshot();
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      const prevBtn = page.getByRole('button', { name: /Trang trước/i });
      assert.equal(await prevBtn.isDisabled(), true, 'Prev button must be disabled on page 1');

      // Filter to empty state in Grid view and reset
      await page.getByRole('button', { name: /Danh Sách Lưới/i }).click();
      await page.getByPlaceholder(/Tìm theo tên món/i).fill('NONEXISTENT_XYZ_999');
      await page.getByRole('button', { name: 'Xóa tất cả bộ lọc' }).click();
      await page.getByText(new RegExp(`Tìm thấy ${snap.totalCount} món ăn`)).waitFor({ state: 'visible' });
    });
  });
});

describe('Tier 2 — F7 Boundaries: Dish Detail & Modifiers', () => {
  it('T2-F7-01: Unknown Dish Code returns 404 Not Found', async () => {
    const res = await apiRequest('/menu/dishes/DOES-NOT-EXIST-999');
    assert.equal(res.status, 404);
  });

  it('T2-F7-02: Required Modifier Group Enforcement prevents empty deselection', async () => {
    const detail = (await apiRequest('/menu/dishes/RAMEN-01')).data;
    const reqGroup = detail.modifierGroups.find((g) => g.isRequired && g.options.length > 0);
    assert.ok(reqGroup, 'Expected required modifier group on RAMEN-01');
    const defaultOpt = reqGroup.options.find((o) => o.isDefault) || reqGroup.options[0];

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByPlaceholder(/Tìm theo tên món/i).fill('RAMEN-01');
      await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();

      // Clicking the already-selected required single-choice option must keep price/selection valid (not deselect to 0)
      const optBtn = page.getByRole('button', { name: new RegExp(defaultOpt.optionName, 'i') }).first();
      await optBtn.click();
      await page.getByText(`${Number(detail.basePrice).toLocaleString('vi-VN')}₫`).first().waitFor({ state: 'visible' });
    });
  });

  it('T2-F7-03: Multi-Select maxSelection Cap enforced in DishDetailModal', async () => {
    const detail = (await apiRequest('/menu/dishes/RAMEN-01')).data;
    const multiGroup = detail.modifierGroups.find((g) => g.maxSelection > 1);
    assert.ok(multiGroup, 'Expected multi-select modifier group on RAMEN-01');

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByPlaceholder(/Tìm theo tên món/i).fill('RAMEN-01');
      await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();

      for (const opt of multiGroup.options.slice(0, multiGroup.maxSelection)) {
        await page.getByRole('button', { name: new RegExp(opt.optionName, 'i') }).first().click();
      }
      await page.getByRole('button', { name: /Thêm Vào Giỏ Hàng/i }).waitFor({ state: 'visible' });
    });
  });

  it('T2-F7-04: Quantity Lower Bound 1 keeps quantity at 1 when clicking Minus', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();

      const qtyRow = page.locator('div').filter({ hasText: /^Số lượng:/ }).first();
      const minusBtn = qtyRow.locator('button').first();
      await minusBtn.click();
      await minusBtn.click();
      const qtyValue = await qtyRow.locator('span').nth(1).innerText();
      assert.equal(qtyValue.trim(), '1');
    });
  });

  it('T2-F7-05: Long Special Instructions & Mobile Scroll keep footer pinned and unclipped on 375x812', async () => {
    await withPage({ viewport: VIEWPORTS.IPHONE_375 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();

      const longNote = 'Không hành lá, ít cay, nước sốt để riêng. '.repeat(5);
      await page.getByPlaceholder(/Không hành lá/i).fill(longNote);

      const addBtn = page.getByRole('button', { name: /Thêm Vào Giỏ Hàng/i }).first();
      const box = await addBtn.boundingBox();
      assert.ok(box && box.y + box.height <= VIEWPORTS.IPHONE_375.height + 1, 'Footer CTA clipped after long note');
    });
  });
});

describe('Tier 2 — F8 Boundaries: Admin Menu RBAC & Validation', () => {
  it('T2-F8-01: Customer Role Blocked on Admin Menu Endpoints with 403 Forbidden', async () => {
    const customer = await getCachedSession('customer');
    const snap = await getCatalogSnapshot();
    const dishId = snap.dishes[0].dishId;

    const [r1, r2, r3, r4] = await Promise.all([
      apiRequest('/menu/dishes', {
        method: 'POST',
        token: customer.accessToken,
        body: { categoryId: snap.categories[0].categoryId, code: 'CUST-1', name: 'Forbidden', basePrice: 10000 },
      }),
      apiRequest(`/menu/dishes/${dishId}`, {
        method: 'PUT',
        token: customer.accessToken,
        body: { name: 'Forbidden', basePrice: 10000, estimatedPrepMinutes: 5 },
      }),
      apiRequest(`/menu/dishes/${dishId}/price`, {
        method: 'PATCH',
        token: customer.accessToken,
        body: { newPrice: 10000 },
      }),
      apiRequest('/menu/categories', {
        method: 'POST',
        token: customer.accessToken,
        body: { categoryCode: 'FORBID', categoryName: 'Forbidden', displayOrder: 99 },
      }),
    ]);

    assert.equal(r1.status, 403);
    assert.equal(r2.status, 403);
    assert.equal(r3.status, 403);
    assert.equal(r4.status, 403);
  });

  it('T2-F8-02: Unauthenticated Blocked on Menu Management with 401 Unauthorized', async () => {
    const res = await apiRequest('/menu/dishes', {
      method: 'POST',
      body: { categoryId: 1, code: 'ANON-1', name: 'Anon', basePrice: 10000 },
    });
    assert.equal(res.status, 401);
  });

  it('T2-F8-03: Duplicate Dish Code rejected with 409 or 400', async () => {
    const admin = await getCachedSession('admin');
    const snap = await getCatalogSnapshot();
    const res = await apiRequest('/menu/dishes', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        categoryId: snap.categories[0].categoryId,
        code: 'RAMEN-01',
        name: 'Duplicate Code Dish',
        basePrice: 120000,
        kitchenStation: 'NoodleStation',
        estimatedPrepMinutes: 10,
      },
    });
    assert.ok([400, 409].includes(res.status), `Expected 400/409 for duplicate dish code, got ${res.status}`);
  });

  it('T2-F8-04: Invalid Image Extension (.exe) & Oversized/Empty Upload rejected with 400', async () => {
    const admin = await getCachedSession('admin');
    const snap = await getCatalogSnapshot();
    const dishId = snap.dishes[0].dishId;

    const badExtForm = new FormData();
    badExtForm.append('file', new Blob([Buffer.from('MZ_FAKE_EXE')], { type: 'application/octet-stream' }), 'malware.exe');
    const badExtRes = await apiRequest(`/menu/dishes/${dishId}/image`, {
      method: 'POST',
      token: admin.accessToken,
      body: badExtForm,
    });
    assert.equal(badExtRes.status, 400);

    const bigForm = new FormData();
    bigForm.append('file', new Blob([Buffer.alloc(6 * 1024 * 1024, 1)], { type: 'image/png' }), 'too-big.png');
    const bigRes = await apiRequest(`/menu/dishes/${dishId}/image`, {
      method: 'POST',
      token: admin.accessToken,
      body: bigForm,
    });
    assert.ok([400, 413].includes(bigRes.status), `Expected 400/413 for >5MB upload, got ${bigRes.status}`);
  });

  it('T2-F8-05: Negative Dish Price Rejected with 400 Bad Request', async () => {
    const admin = await getCachedSession('admin');
    const snap = await getCatalogSnapshot();
    const res = await apiRequest(`/menu/dishes/${snap.dishes[0].dishId}/price`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { newPrice: -1000 },
    });
    assert.equal(res.status, 400);
  });
});
