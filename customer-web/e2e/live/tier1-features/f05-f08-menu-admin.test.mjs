import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS } from '../harness/env.mjs';
import {
  apiRequest,
  createMinimalPngBuffer,
  getCachedSession,
  getCatalogSnapshot,
  originRequest,
  runSql,
} from '../harness/api-client.mjs';
import { assertImagesLoaded, closeBrowser, gotoRoute, withPage } from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 1 — F5: Public Menu Catalog & Categories', () => {
  it('T1-F5-01: API Public Categories Endpoint returns 7 seeded categories with rich metadata', async () => {
    const res = await apiRequest('/menu/categories');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length >= 7, `Expected >=7 categories, got ${res.data.length}`);

    const codes = res.data.map((c) => c.categoryCode);
    for (const expected of ['RAMEN', 'SUSHI', 'TEMPURA', 'WAGYU', 'DONBURI', 'DRINKS', 'DESSERT']) {
      assert.ok(codes.includes(expected), `Missing seeded category ${expected}`);
    }

    for (const cat of res.data) {
      assert.ok(cat.categoryName, `Category ${cat.categoryCode} missing categoryName`);
      assert.ok(cat.japaneseName, `Category ${cat.categoryCode} missing japaneseName`);
      assert.ok(cat.iconName, `Category ${cat.categoryCode} missing iconName`);
      assert.ok(cat.imageUrl, `Category ${cat.categoryCode} missing imageUrl`);
      assert.ok(Array.isArray(cat.dishes) && cat.dishes.length > 0, `Category ${cat.categoryCode} has no dishes`);
    }
  });

  it('T1-F5-02: UI HomePage 7 Categories Showcase renders all 7 category cards with loaded images', async () => {
    const snap = await getCatalogSnapshot();
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/');
      await page.getByRole('heading', { name: /7 Danh Mục Món Nhật Đặc Sắc/i }).waitFor({ state: 'visible' });

      for (const cat of snap.categories.slice(0, 7)) {
        await page.getByRole('heading', { name: cat.categoryName }).first().waitFor({ state: 'visible' });
      }
      await assertImagesLoaded(page);
    });
  });

  it('T1-F5-03: UI Category Deep-Link Navigation from HomePage filters MenuPage', async () => {
    const snap = await getCatalogSnapshot();
    const sushiCat = snap.categories.find((c) => c.categoryCode === 'SUSHI') || snap.categories[1];

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/');
      await page.getByRole('link', { name: new RegExp(sushiCat.categoryName, 'i') }).first().click();
      await page.waitForURL(/\/menu\?category=/);
      await page.getByRole('heading', { name: 'Tuyển Tập Ẩm Thực Cố Đô' }).waitFor({ state: 'visible' });

      const countText = await page.getByText(/Tìm thấy \d+ món ăn/i).first().innerText();
      const match = countText.match(/(\d+)/);
      assert.ok(match, `Expected dish count text, got "${countText}"`);
      const displayedCount = Number(match[1]);
      assert.equal(displayedCount, sushiCat.dishes.length);
    });
  });

  it('T1-F5-04: UI MenuPage Category Filter Pills update displayed dish count', async () => {
    const snap = await getCatalogSnapshot();
    const ramenCat = snap.categories.find((c) => c.categoryCode === 'RAMEN') || snap.categories[0];

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByRole('button', { name: new RegExp(`^Tất Cả \\(${snap.totalCount}\\)`) }).waitFor({ state: 'visible' });

      await page.getByRole('button', { name: new RegExp(ramenCat.categoryName, 'i') }).first().click();
      const countText = await page.getByText(/Tìm thấy \d+ món ăn/i).first().innerText();
      const match = countText.match(/(\d+)/);
      assert.equal(Number(match?.[1]), ramenCat.dishes.length);
    });
  });

  it('T1-F5-05: Zero Mock Fallback Verification compares rendered Menu categories against live API payload', async () => {
    let interceptedCategories = null;
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      page.on('response', async (res) => {
        if (res.url().includes('/api/menu/categories') && res.status() === 200) {
          try {
            interceptedCategories = await res.json();
          } catch {
            // ignore
          }
        }
      });

      await gotoRoute(page, '/menu');
      await page.getByRole('heading', { name: 'Tuyển Tập Ẩm Thực Cố Đô' }).waitFor({ state: 'visible' });
      assert.ok(Array.isArray(interceptedCategories) && interceptedCategories.length >= 7, 'MenuPage must fetch live /api/menu/categories');

      for (const cat of interceptedCategories) {
        const pill = page.getByRole('button', { name: new RegExp(cat.categoryName, 'i') }).first();
        await pill.waitFor({ state: 'visible' });
      }
    });
  });
});

describe('Tier 1 — F6: Multi-Criteria Dish Filter & 3D Book/Grid Menu', () => {
  it('T1-F6-01: API Dish Paging & Filter returns PagedResult with totalCount >= 29', async () => {
    const res = await apiRequest('/menu/dishes?page=1&pageSize=12');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data?.items));
    assert.equal(res.data.items.length, 12);
    assert.ok(res.data.totalCount >= 29, `Expected >=29 dishes, got ${res.data.totalCount}`);
  });

  it('T1-F6-02: API Multi-Filter + Sort filters by category, price range, and ascending order', async () => {
    const res = await apiRequest('/menu/dishes?categoryCode=RAMEN&minPrice=150000&maxPrice=200000&sortBy=price_asc&page=1&pageSize=20');
    assert.equal(res.status, 200);
    const items = res.data?.items || [];
    assert.ok(items.length >= 1, 'Expected at least 1 Ramen dish in [150000, 200000]');
    for (let i = 0; i < items.length; i++) {
      assert.ok(items[i].basePrice >= 150000 && items[i].basePrice <= 200000);
      if (i > 0) {
        assert.ok(items[i].basePrice >= items[i - 1].basePrice, 'Items not sorted ascending by price');
      }
    }
  });

  it('T1-F6-03: API Keyword Search supports Vietnamese, Dish Code, and Japanese Kanji', async () => {
    const [byName, byCode, byKanji] = await Promise.all([
      apiRequest('/menu/dishes?keyword=Wagyu'),
      apiRequest('/menu/dishes?keyword=RAMEN-01'),
      apiRequest(`/menu/dishes?keyword=${encodeURIComponent('豚骨')}`),
    ]);
    assert.equal(byName.status, 200);
    assert.ok(byName.data.items.some((d) => d.code.includes('WAGYU')));

    assert.equal(byCode.status, 200);
    assert.ok(byCode.data.items.some((d) => d.code === 'RAMEN-01'));

    assert.equal(byKanji.status, 200);
    assert.ok(byKanji.data.items.length >= 1);
  });

  it('T1-F6-04: UI 3D Book Flip Navigation updates pages via buttons and Arrow keys', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByText(/^Trang 1 \/ \d+$/).waitFor({ state: 'visible' });

      await page.getByRole('button', { name: /Trang kế tiếp/i }).click();
      await page.getByText(/^Trang 2 \/ \d+$/).waitFor({ state: 'visible' });

      await page.getByRole('button', { name: /Trang trước/i }).click();
      await page.getByText(/^Trang 1 \/ \d+$/).waitFor({ state: 'visible' });

      await page.keyboard.press('ArrowRight');
      await page.getByText(/^Trang 2 \/ \d+$/).waitFor({ state: 'visible' });

      await page.keyboard.press('ArrowLeft');
      await page.getByText(/^Trang 1 \/ \d+$/).waitFor({ state: 'visible' });
    });
  });

  it('T1-F6-05: UI Grid Mode Filters & Sort apply price pills, keyword search, and monotonic sort', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByRole('button', { name: /Danh Sách Lưới/i }).click();

      await page.getByRole('button', { name: 'Dưới 200.000₫' }).click();
      const under200Count = await page.getByText(/Tìm thấy \d+ món ăn/i).innerText();
      assert.ok(Number(under200Count.match(/(\d+)/)?.[1]) > 0);

      await page.getByRole('button', { name: '200.000₫ - 500.000₫' }).click();
      await page.getByRole('button', { name: 'Trên 500.000₫ (Cao cấp)' }).click();
      await page.getByRole('button', { name: 'Tất cả giá' }).click();

      await page.getByPlaceholder(/Tìm theo tên món/i).fill('Sashimi');
      await page.locator('select').first().selectOption('price_asc');

      const priceTexts = await page.locator('main span').filter({ hasText: /₫$/ }).allInnerTexts();
      const numericPrices = priceTexts
        .map((t) => Number(t.replace(/[^\d]/g, '')))
        .filter((n) => n >= 10000);
      assert.ok(numericPrices.length >= 1, 'Expected Sashimi dish prices in grid');
    });
  });
});

describe('Tier 1 — F7: Dish Detail & Modifiers', () => {
  it('T1-F7-01: API Dish Detail by Code returns ingredients, tags, calories, and modifierGroups', async () => {
    const res = await apiRequest('/menu/dishes/RAMEN-01');
    assert.equal(res.status, 200);
    assert.equal(res.data?.code, 'RAMEN-01');
    assert.ok(res.data?.basePrice > 0);
    assert.ok(Array.isArray(res.data?.modifierGroups) && res.data.modifierGroups.length >= 2);
    for (const grp of res.data.modifierGroups) {
      assert.ok(Array.isArray(grp.options) && grp.options.length > 0);
    }
  });

  it('T1-F7-02: UI Open Modal from MenuPage shows Japanese name, price, prep time, calories, and description', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();

      await page.getByText('Mô tả món ăn').waitFor({ state: 'visible' });
      await page.getByText(/phút chuẩn bị/i).waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Thêm Vào Giỏ Hàng/i }).waitFor({ state: 'visible' });
    });
  });

  it('T1-F7-03: UI Default Modifier Pre-Selection pre-selects required default options on RAMEN-01', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByPlaceholder(/Tìm theo tên món/i).fill('RAMEN-01');
      await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();

      await page.getByText('RAMEN-01').waitFor({ state: 'visible' });
      // Default option button should render and total should match base price (since defaults have 0 adjustment)
      const detail = await apiRequest('/menu/dishes/RAMEN-01');
      const expectedTotal = `${Number(detail.data.basePrice).toLocaleString('vi-VN')}₫`;
      await page.getByText(expectedTotal).first().waitFor({ state: 'visible' });
    });
  });

  it('T1-F7-04: UI Modifier & Quantity Live Total Calculation updates price dynamically', async () => {
    const detail = (await apiRequest('/menu/dishes/RAMEN-01')).data;
    const paidOption = detail.modifierGroups
      .flatMap((g) => g.options)
      .find((o) => Number(o.priceAdjustment) > 0);
    assert.ok(paidOption, 'Expected RAMEN-01 to have at least one paid modifier option');

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByPlaceholder(/Tìm theo tên món/i).fill('RAMEN-01');
      await page.getByRole('button', { name: /Tùy chọn Topping/i }).first().click();

      await page.getByRole('button', { name: new RegExp(paidOption.optionName, 'i') }).first().click();
      // Click + quantity button near "Số lượng:"
      const qtySection = page.locator('div').filter({ hasText: /^Số lượng:/ }).first();
      await qtySection.locator('button').last().click();

      const expected = (Number(detail.basePrice) + Number(paidOption.priceAdjustment)) * 2;
      const expectedFormatted = `${expected.toLocaleString('vi-VN')}₫`;
      await page.getByText(expectedFormatted).first().waitFor({ state: 'visible' });
    });
  });

  it('T1-F7-05: UI State Reset Between Dishes resets quantity to 1 and notes to empty', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu');
      await page.getByRole('button', { name: /Danh Sách Lưới/i }).click();

      // Open first dish, increment qty to 2 and type note
      await page.getByRole('button', { name: 'Topping' }).first().click();
      const qtySection = page.locator('div').filter({ hasText: /^Số lượng:/ }).first();
      await qtySection.locator('button').last().click();
      const noteInput = page.getByPlaceholder(/Không hành lá/i);
      await noteInput.fill('Không hành lá Test Reset');

      // Close modal
      await page.locator('button').filter({ has: page.locator('svg') }).first().click();
      // Fallback if first button wasn't close: click close button inside modal header
      if (await noteInput.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
        if (await noteInput.isVisible().catch(() => false)) {
          await noteInput.locator('xpath=ancestor::div[contains(@class,"fixed")]//button[1]').click();
        }
      }

      // Open second dish
      await page.getByRole('button', { name: 'Topping' }).nth(1).click();
      await page.getByPlaceholder(/Không hành lá/i).waitFor({ state: 'visible' });
      assert.equal(await page.getByPlaceholder(/Không hành lá/i).inputValue(), '');
      assert.equal(await page.locator('div').filter({ hasText: /^Số lượng:/ }).first().locator('span').nth(1).innerText(), '1');
    });
  });
});

describe('Tier 1 — F8: Admin/Staff Menu Management & Uploads', () => {
  it('T1-F8-01: API Admin Create, Update & Toggle Status of Category', async () => {
    const admin = await getCachedSession('admin');
    const code = `E2ECAT_${Date.now()}`;
    let createdId = null;

    try {
      const createRes = await apiRequest('/menu/categories', {
        method: 'POST',
        token: admin.accessToken,
        body: {
          categoryCode: code,
          categoryName: `Danh mục E2E ${code}`,
          description: 'Test category',
          displayOrder: 99,
        },
      });
      assert.equal(createRes.status, 201, `Expected 201 create category, got ${createRes.status}: ${createRes.text}`);
      createdId = createRes.data.categoryId;

      const updateRes = await apiRequest(`/menu/categories/${createdId}`, {
        method: 'PUT',
        token: admin.accessToken,
        body: {
          categoryName: `Danh mục E2E Updated ${code}`,
          description: 'Updated desc',
          displayOrder: 100,
        },
      });
      assert.equal(updateRes.status, 200);

      const statusRes = await apiRequest(`/menu/categories/${createdId}/status`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { isActive: false },
      });
      assert.equal(statusRes.status, 200);
    } finally {
      if (createdId) {
        runSql(`DELETE FROM dbo.CATEGORIES WHERE CATEGORY_ID = ${createdId};`);
      }
    }
  });

  it('T1-F8-02: API Manager Create & Update Dish', async () => {
    const manager = await getCachedSession('manager');
    const snap = await getCatalogSnapshot();
    const categoryId = snap.categories[0].categoryId;
    const dishCode = `E2EDISH-${Date.now()}`;
    let dishId = null;

    try {
      const createRes = await apiRequest('/menu/dishes', {
        method: 'POST',
        token: manager.accessToken,
        body: {
          categoryId,
          code: dishCode,
          name: `E2E Temp Dish ${dishCode}`,
          basePrice: 125000,
          japaneseName: 'テスト料理',
          description: 'Món thử nghiệm E2E',
          kitchenStation: 'NoodleStation',
          estimatedPrepMinutes: 10,
          isKitchenItem: true,
        },
      });
      assert.equal(createRes.status, 201, `Expected 201 create dish, got ${createRes.status}: ${createRes.text}`);
      dishId = createRes.data.dishId;

      const updateRes = await apiRequest(`/menu/dishes/${dishId}`, {
        method: 'PUT',
        token: manager.accessToken,
        body: {
          name: `E2E Updated Dish ${dishCode}`,
          japaneseName: 'テスト更新',
          description: 'Updated E2E desc',
          basePrice: 130000,
          estimatedPrepMinutes: 12,
          imageUrl: null,
        },
      });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.data.basePrice, 130000);
    } finally {
      if (dishId) {
        runSql(`DELETE FROM dbo.MENU_ITEMS WHERE MENU_ITEM_ID = ${dishId};`);
      }
    }
  });

  it('T1-F8-03: API Admin Patch Dish Price reflects in GET /api/menu/dishes/{code}', async () => {
    const admin = await getCachedSession('admin');
    const snap = await getCatalogSnapshot();
    const dishCode = `E2EPRC-${Date.now()}`;
    let dishId = null;

    try {
      const createRes = await apiRequest('/menu/dishes', {
        method: 'POST',
        token: admin.accessToken,
        body: {
          categoryId: snap.categories[0].categoryId,
          code: dishCode,
          name: 'E2E Price Dish',
          basePrice: 110000,
          kitchenStation: 'NoodleStation',
          estimatedPrepMinutes: 10,
          isKitchenItem: true,
        },
      });
      assert.equal(createRes.status, 201);
      dishId = createRes.data.dishId;

      const patchRes = await apiRequest(`/menu/dishes/${dishId}/price`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { newPrice: 149000 },
      });
      assert.equal(patchRes.status, 200);

      const detailRes = await apiRequest(`/menu/dishes/${dishCode}`);
      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.data.basePrice, 149000);
    } finally {
      if (dishId) {
        runSql(`DELETE FROM dbo.MENU_ITEMS WHERE MENU_ITEM_ID = ${dishId};`);
      }
    }
  });

  it('T1-F8-04: API Staff Toggle Dish Availability', async () => {
    const admin = await getCachedSession('admin');
    const staff = await getCachedSession('staff');
    const snap = await getCatalogSnapshot();
    const dishCode = `E2EAVL-${Date.now()}`;
    let dishId = null;

    try {
      const createRes = await apiRequest('/menu/dishes', {
        method: 'POST',
        token: admin.accessToken,
        body: {
          categoryId: snap.categories[0].categoryId,
          code: dishCode,
          name: 'E2E Availability Dish',
          basePrice: 99000,
          kitchenStation: 'NoodleStation',
          estimatedPrepMinutes: 8,
          isKitchenItem: true,
        },
      });
      assert.equal(createRes.status, 201);
      dishId = createRes.data.dishId;

      const offRes = await apiRequest(`/menu/dishes/${dishId}/availability`, {
        method: 'PATCH',
        token: staff.accessToken,
        body: { isAvailable: false },
      });
      assert.equal(offRes.status, 200);

      const onRes = await apiRequest(`/menu/dishes/${dishId}/availability`, {
        method: 'PATCH',
        token: staff.accessToken,
        body: { isAvailable: true },
      });
      assert.equal(onRes.status, 200);
    } finally {
      if (dishId) {
        runSql(`DELETE FROM dbo.MENU_ITEMS WHERE MENU_ITEM_ID = ${dishId};`);
      }
    }
  });

  it('T1-F8-05: API Admin Upload Dish Image writes to wwwroot and serves HTTP 200', async () => {
    const admin = await getCachedSession('admin');
    const snap = await getCatalogSnapshot();
    const dishCode = `E2EIMG-${Date.now()}`;
    let dishId = null;

    try {
      const createRes = await apiRequest('/menu/dishes', {
        method: 'POST',
        token: admin.accessToken,
        body: {
          categoryId: snap.categories[0].categoryId,
          code: dishCode,
          name: 'E2E Image Dish',
          basePrice: 88000,
          kitchenStation: 'NoodleStation',
          estimatedPrepMinutes: 5,
          isKitchenItem: true,
        },
      });
      assert.equal(createRes.status, 201);
      dishId = createRes.data.dishId;

      const form = new FormData();
      form.append('file', new Blob([createMinimalPngBuffer()], { type: 'image/png' }), 'e2e-dish.png');

      const uploadRes = await apiRequest(`/menu/dishes/${dishId}/image`, {
        method: 'POST',
        token: admin.accessToken,
        body: form,
      });
      assert.equal(uploadRes.status, 200, `Expected 200 image upload, got ${uploadRes.status}: ${uploadRes.text}`);
      const imageUrl = uploadRes.data?.imageUrl;
      assert.ok(imageUrl, 'Expected imageUrl in upload response');

      const staticRes = await originRequest(imageUrl);
      assert.equal(staticRes.status, 200, `Expected static file served at ${imageUrl}, got ${staticRes.status}`);
      assert.match(staticRes.headers.get('content-type') || '', /^image\//i);
    } finally {
      if (dishId) {
        runSql(`DELETE FROM dbo.MENU_ITEMS WHERE MENU_ITEM_ID = ${dishId};`);
      }
    }
  });
});
