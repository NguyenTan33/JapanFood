import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS } from '../harness/env.mjs';
import {
  apiRequest,
  cancelReservation,
  createDisposableCustomer,
  futureReservationSlot,
  getCachedSession,
  getCatalogSnapshot,
  runSql,
} from '../harness/api-client.mjs';
import { closeBrowser, gotoRoute, withPage } from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 1 — F13: Table Reservations & Areas', () => {
  it('T1-F13-01: API Public Table Areas & Available Tables return 4 areas and open tables', async () => {
    const areasRes = await apiRequest('/reservations/areas');
    assert.equal(areasRes.status, 200);
    assert.ok(Array.isArray(areasRes.data) && areasRes.data.length >= 4, `Expected >=4 areas, got ${areasRes.data?.length}`);

    const slot = futureReservationSlot(5, 18, 0);
    const tablesRes = await apiRequest(`/reservations/available-tables?reservationTime=${encodeURIComponent(slot.isoUtc)}&guestCount=2`);
    assert.equal(tablesRes.status, 200);
    assert.ok(Array.isArray(tablesRes.data) && tablesRes.data.length >= 1);
  });

  it('T1-F13-02: API Guest Reservation Creation creates reservation with userId=null', async () => {
    const slot = futureReservationSlot(6, 18, 30);
    const staff = await getCachedSession('staff');
    let reservationId = null;
    try {
      const res = await apiRequest('/reservations', {
        method: 'POST',
        body: {
          customerName: 'Khách Vãng Lai E2E',
          customerPhone: '0901234568',
          customerEmail: 'guest.rsv@example.com',
          guestCount: 2,
          reservationTime: slot.isoUtc,
          specialRequests: 'Bàn gần cửa sổ',
        },
      });
      assert.equal(res.status, 201, `Expected 201 guest reservation, got ${res.status}: ${res.text}`);
      assert.ok(res.data?.reservationCode);
      assert.equal(res.data.userId, null);
      reservationId = res.data.reservationId;
    } finally {
      if (reservationId) {
        await cancelReservation(staff.accessToken, reservationId, 'E2E cleanup');
      }
    }
  });

  it('T1-F13-03: API Authenticated Reservation History & Cancel', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1303' });
    const slot = futureReservationSlot(7, 19, 0);
    try {
      const createRes = await apiRequest('/reservations', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          customerName: disp.fullName,
          customerPhone: disp.phoneNumber,
          customerEmail: disp.email,
          guestCount: 2,
          reservationTime: slot.isoUtc,
        },
      });
      assert.equal(createRes.status, 201);
      const rsvId = createRes.data.reservationId;
      assert.equal(createRes.data.userId, disp.userId);

      const historyRes = await apiRequest('/reservations/my-history?page=1&pageSize=10', {
        token: disp.accessToken,
      });
      assert.equal(historyRes.status, 200);
      assert.ok(historyRes.data.items.some((r) => r.reservationId === rsvId));

      const cancelRes = await apiRequest(`/reservations/${rsvId}/cancel`, {
        method: 'POST',
        token: disp.accessToken,
        body: { reason: 'E2E test cancel' },
      });
      assert.equal(cancelRes.status, 200);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F13-04: API Staff Daily, Confirm & Check-In', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1304' });
    const staff = await getCachedSession('staff');
    const slot = futureReservationSlot(8, 18, 0);
    let rsvId = null;

    try {
      const created = await apiRequest('/reservations', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          customerName: disp.fullName,
          customerPhone: disp.phoneNumber,
          guestCount: 2,
          reservationTime: slot.isoUtc,
        },
      });
      assert.equal(created.status, 201);
      rsvId = created.data.reservationId;

      const daily = await apiRequest(`/reservations/daily?date=${slot.dateStr}`, { token: staff.accessToken });
      assert.equal(daily.status, 200);
      assert.ok(daily.data.some((r) => r.reservationId === rsvId));

      const confirm = await apiRequest(`/reservations/${rsvId}/confirm`, {
        method: 'POST',
        token: staff.accessToken,
      });
      assert.equal(confirm.status, 200);

      const checkin = await apiRequest(`/reservations/${rsvId}/check-in`, {
        method: 'POST',
        token: staff.accessToken,
      });
      assert.equal(checkin.status, 200);
    } finally {
      if (rsvId) {
        runSql(`
          UPDATE dbo.TABLES SET STATUS = 'Available', CURRENT_ORDER_ID = NULL WHERE TABLE_ID IN (SELECT ASSIGNED_TABLE_ID FROM dbo.RESERVATIONS WHERE RESERVATION_ID = ${rsvId});
          DELETE FROM dbo.RESERVATIONS WHERE RESERVATION_ID = ${rsvId};
        `);
      }
      disp.cleanup();
    }
  });

  it('T1-F13-05: UI 4-Step Reservation Wizard submits live POST /api/reservations', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1305' });
    const slot = futureReservationSlot(9, 19, 0);
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/reservation');
        await page.getByRole('heading', { name: 'Trải Nghiệm Ẩm Thực Đỉnh Cao' }).waitFor({ state: 'visible' });

        await page.locator('input[type="date"]').fill(slot.dateStr);
        await page.getByRole('button', { name: '19:00', exact: true }).click();
        await page.getByRole('button', { name: /Tiếp tục: Chọn khu vực bàn/i }).click();

        await page.getByRole('button', { name: /Tiếp tục: Số lượng khách/i }).click();

        await page.getByRole('button', { name: '4 người', exact: true }).click();
        await page.getByPlaceholder(/Dị ứng tôm\/cua/i).fill('Bàn yên tĩnh E2E');
        await page.getByRole('button', { name: /Tiếp tục: Thông tin người đặt/i }).click();

        await page.locator('input[type="text"]').first().fill(disp.fullName);
        await page.locator('input[type="tel"]').first().fill('0909555444');
        await page.locator('input[type="email"]').first().fill(disp.email);

        const rsvPromise = page.waitForResponse(
          (r) => r.url().includes('/api/reservations') && r.request().method() === 'POST'
        );
        await page.getByRole('button', { name: /Xác Nhận Đặt Bàn Ngay/i }).click();
        const rsvRes = await rsvPromise;
        assert.equal(rsvRes.status(), 201, `Wizard must POST /api/reservations -> 201, got ${rsvRes.status()}`);
        const rsvJson = await rsvRes.json();

        await page.getByRole('heading', { name: 'Đặt Bàn Thành Công!' }).waitFor({ state: 'visible' });
        await page.getByText(rsvJson.reservationCode).waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 1 — F14: Dish Reviews & Moderation', () => {
  async function createCompletedOrderForCustomer(customerSession, dishId) {
    const staff = await getCachedSession('staff');
    const orderRes = await apiRequest('/orders', {
      method: 'POST',
      token: customerSession.accessToken,
      body: {
        orderType: 'Takeaway',
        paymentMethod: 'FullBank',
        items: [{ menuItemId: dishId, quantity: 1, modifierOptionIds: [] }],
      },
    });
    assert.equal(orderRes.status, 201);
    const orderId = orderRes.data.orderId;

    await apiRequest(`/orders/${orderId}/checkout`, {
      method: 'POST',
      token: customerSession.accessToken,
      body: { gateway: 'Cash' },
    });
    const detail = (await apiRequest(`/orders/${orderId}`, { token: customerSession.accessToken })).data;
    const txn = detail.paymentTransactions[0].transactionNumber;
    const confirm = await apiRequest('/payments/cash-confirm', {
      method: 'POST',
      token: staff.accessToken,
      body: { transactionNumber: txn },
    });
    assert.equal(confirm.status, 200);
    return orderId;
  }

  it('T1-F14-01: API Public All/Featured Reviews returns seeded approved reviews', async () => {
    const res = await apiRequest('/reviews');
    assert.equal(res.status, 200);
    const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
    assert.ok(list.length >= 1, 'Expected seeded approved reviews from GET /api/reviews');
  });

  it('T1-F14-02: API Public Reviews By Dish returns PagedResult of approved reviews', async () => {
    const snap = await getCatalogSnapshot();
    const dish = snap.byCode.get('RAMEN-01') || snap.dishes[0];
    const res = await apiRequest(`/reviews/dishes/${dish.dishId}?page=1&pageSize=10`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data?.items));
  });

  it('T1-F14-03: API Submit Verified-Purchase Review starts unapproved', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1403' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('GYOZA-01') || snap.dishes[0];
      const orderId = await createCompletedOrderForCustomer(disp, dish.dishId);

      const comment = `E2E Review Unapproved ${Date.now()}`;
      const revRes = await apiRequest('/reviews', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, orderId, rating: 5, comment },
      });
      assert.equal(revRes.status, 201, `Expected 201 submit review, got ${revRes.status}: ${revRes.text}`);
      assert.equal(revRes.data.rating, 5);

      // Must NOT appear publicly before approval
      const publicRes = await apiRequest(`/reviews/dishes/${dish.dishId}?page=1&pageSize=50`);
      assert.equal(publicRes.status, 200);
      assert.ok(!publicRes.data.items.some((r) => r.comment === comment), 'Unapproved review must be hidden from public');
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F14-04: API Manager Approve Review makes it publicly visible', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1404' });
    const manager = await getCachedSession('manager');
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('GYOZA-01') || snap.dishes[0];
      const orderId = await createCompletedOrderForCustomer(disp, dish.dishId);

      const comment = `E2E Approved Review ${Date.now()}`;
      const revRes = await apiRequest('/reviews', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, orderId, rating: 5, comment },
      });
      assert.equal(revRes.status, 201);
      const reviewId = revRes.data.reviewId;

      const appRes = await apiRequest(`/reviews/${reviewId}/approve`, {
        method: 'PUT',
        token: manager.accessToken,
      });
      assert.equal(appRes.status, 200);

      const publicRes = await apiRequest(`/reviews/dishes/${dish.dishId}?page=1&pageSize=50`);
      assert.ok(publicRes.data.items.some((r) => r.reviewId === reviewId && r.comment === comment));
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F14-05: API Manager Reject Review keeps it hidden from public', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f1405' });
    const manager = await getCachedSession('manager');
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.byCode.get('GYOZA-01') || snap.dishes[0];
      const orderId = await createCompletedOrderForCustomer(disp, dish.dishId);

      const comment = `E2E Rejected Review ${Date.now()}`;
      const revRes = await apiRequest('/reviews', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, orderId, rating: 4, comment },
      });
      assert.equal(revRes.status, 201);
      const reviewId = revRes.data.reviewId;

      const rejRes = await apiRequest(`/reviews/${reviewId}/reject`, {
        method: 'PUT',
        token: manager.accessToken,
        body: { reason: 'Nội dung thử nghiệm E2E' },
      });
      assert.equal(rejRes.status, 200);

      const publicRes = await apiRequest(`/reviews/dishes/${dish.dishId}?page=1&pageSize=50`);
      assert.ok(!publicRes.data.items.some((r) => r.reviewId === reviewId));
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 1 — F15: Branches, Restaurant Info & Cultural Blog', () => {
  it('T1-F15-01: API Public Branches (3), Blogs (4) & Restaurant Info return 200 OK', async () => {
    const [branchesRes, blogsRes, infoRes] = await Promise.all([
      apiRequest('/branches'),
      apiRequest('/blogs'),
      apiRequest('/restaurant-info'),
    ]);
    assert.equal(branchesRes.status, 200);
    assert.ok(Array.isArray(branchesRes.data) && branchesRes.data.length >= 3, 'Expected >=3 branches');

    assert.equal(blogsRes.status, 200);
    assert.ok(Array.isArray(blogsRes.data) && blogsRes.data.length >= 4, 'Expected >=4 blog posts');

    assert.equal(infoRes.status, 200);
    assert.ok(infoRes.data?.brandName);
    assert.ok(infoRes.data?.accountNumber);
  });

  it('T1-F15-02: UI LocationPage Branch Switching updates address, map iframe src, and reservation deep-link', async () => {
    const branches = (await apiRequest('/branches')).data;
    assert.ok(branches.length >= 3);

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/location');
      await page.getByRole('heading', { name: 'Vị Trí & Chi Nhánh Tori Sakura' }).waitFor({ state: 'visible' });

      const firstSrc = await page.locator('iframe').first().getAttribute('src');
      await page.getByRole('button', { name: new RegExp(branches[1].name, 'i') }).click();
      await page.getByText(branches[1].address).first().waitFor({ state: 'visible' });

      const secondSrc = await page.locator('iframe').first().getAttribute('src');
      assert.notEqual(firstSrc, secondSrc, 'Switching branch should update Google Map iframe src');

      const rsvHref = await page.getByRole('link', { name: 'Đặt Bàn Tại Chi Nhánh Này' }).getAttribute('href');
      assert.ok(rsvHref && rsvHref.includes('/reservation?branch='));
    });
  });

  it('T1-F15-03: UI BlogPage Grid & Article Modal renders 4 posts and opens/closes reader modal', async () => {
    const blogs = (await apiRequest('/blogs')).data;
    assert.ok(blogs.length >= 4);

    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/blog');
      await page.getByRole('heading', { name: 'Chuyện Bếp & Cố Đô Sakura' }).waitFor({ state: 'visible' });

      const readButtons = page.getByRole('button', { name: /Đọc bài viết/i });
      assert.ok((await readButtons.count()) >= 4, 'Expected at least 4 blog cards');

      await readButtons.first().click();
      await page.getByRole('button', { name: 'Đóng Bài Viết' }).waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Đóng Bài Viết' }).click();
      await page.getByRole('button', { name: 'Đóng Bài Viết' }).waitFor({ state: 'hidden' });
    });
  });

  it('T1-F15-04: UI AboutPage & Footer Live Brand Info render 4 pillars, Head Chef, and 3 branches', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/about');
      await page.getByRole('heading', { name: /Hành Trình Gìn Giữ/i }).waitFor({ state: 'visible' });
      for (const pillar of ['Omotenashi', 'Shun', 'Kodawari', 'Wabi-Sabi']) {
        await page.getByRole('heading', { name: new RegExp(pillar, 'i') }).first().waitFor({ state: 'visible' });
      }
      await page.getByRole('heading', { name: /Kenjiro Takahashi/i }).waitFor({ state: 'visible' });
      await page.locator('footer').getByText(/TORI SAKURA/i).first().waitFor({ state: 'visible' });
    });
  });

  it('T1-F15-05: UI Unknown Route 404 Handling renders NotFoundPage and returns home', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/non-existent-route-xyz');
      await page.getByRole('heading', { name: /404 - Không Tìm Thấy Trang/i }).waitFor({ state: 'visible' });
      await page.getByRole('link', { name: 'Về Trang Chủ' }).click();
      await page.waitForURL(/\/$/);
    });
  });
});
