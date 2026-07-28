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
import { assertNoHorizontalOverflow, closeBrowser, gotoRoute, withPage } from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 2 — F13 Boundaries: Reservations & Isolation', () => {
  it('T2-F13-01: Past Reservation Time & Invalid Phone rejected with 400', async () => {
    const pastIso = new Date(Date.now() - 86400_000).toISOString();
    const pastRes = await apiRequest('/reservations', {
      method: 'POST',
      body: {
        customerName: 'Past Time Guest',
        customerPhone: '0901234567',
        guestCount: 2,
        reservationTime: pastIso,
      },
    });
    assert.equal(pastRes.status, 400);

    const future = futureReservationSlot(10, 19, 0);
    const badPhoneRes = await apiRequest('/reservations', {
      method: 'POST',
      body: {
        customerName: 'Bad Phone Guest',
        customerPhone: '123',
        guestCount: 2,
        reservationTime: future.isoUtc,
      },
    });
    assert.equal(badPhoneRes.status, 400);
  });

  it('T2-F13-02: Overlapping Time Slot Exhaustion returns 400 when all tables in area are booked', async () => {
    const slot = futureReservationSlot(45, 19, 0);
    const slotPlus30 = futureReservationSlot(45, 19, 30);
    const createdIds = [];

    try {
      const areas = (await apiRequest('/reservations/areas')).data;
      const barArea = areas.find((a) => a.code === 'BAR') || areas[areas.length - 1];
      const avail = (
        await apiRequest(
          `/reservations/available-tables?reservationTime=${encodeURIComponent(slot.isoUtc)}&guestCount=2&areaId=${barArea.id || barArea.areaId}`
        )
      ).data;
      assert.ok(avail.length >= 1 && avail.length <= 10, `Expected 1..10 tables in area, got ${avail.length}`);

      const areaId = barArea.id || barArea.areaId;
      for (let i = 0; i < avail.length; i++) {
        const book = await apiRequest('/reservations', {
          method: 'POST',
          body: {
            customerName: `Exhaust Guest ${i}`,
            customerPhone: `090888000${i}`,
            guestCount: Math.max(1, avail[i].minCapacity || 1),
            reservationTime: slot.isoUtc,
            preferredAreaId: areaId,
          },
        });
        assert.equal(book.status, 201, `Booking ${i} failed: ${book.text}`);
        createdIds.push(book.data.reservationId);
      }

      // Next overlapping request at T+30m in same area must fail with 400
      const overflowBook = await apiRequest('/reservations', {
        method: 'POST',
        body: {
          customerName: 'Overflow Guest',
          customerPhone: '0908889999',
          guestCount: 2,
          reservationTime: slotPlus30.isoUtc,
          preferredAreaId: areaId,
        },
      });
      assert.equal(overflowBook.status, 400, `Expected 400 when tables exhausted, got ${overflowBook.status}`);
    } finally {
      if (createdIds.length) {
        runSql(`DELETE FROM dbo.RESERVATIONS WHERE RESERVATION_ID IN (${createdIds.join(',')});`);
      }
    }
  });

  it('T2-F13-03: Anonymous UserId Injection Blocked (stored userId MUST be null)', async () => {
    const slot = futureReservationSlot(12, 18, 0);
    let rsvId = null;
    try {
      const res = await apiRequest('/reservations', {
        method: 'POST',
        body: {
          userId: 4,
          customerName: 'Spoof Guest',
          customerPhone: '0907776665',
          guestCount: 2,
          reservationTime: slot.isoUtc,
        },
      });
      assert.equal(res.status, 201);
      rsvId = res.data.reservationId;
      assert.equal(res.data.userId, null, 'Unauthenticated reservation must never attach to spoofed userId');
    } finally {
      if (rsvId) runSql(`DELETE FROM dbo.RESERVATIONS WHERE RESERVATION_ID = ${rsvId};`);
    }
  });

  it('T2-F13-04: Unauthenticated (401) & Cross-User Reservation Cancel IDOR (403)', async () => {
    const anonHistory = await apiRequest('/reservations/my-history');
    assert.equal(anonHistory.status, 401);

    const anonCancel = await apiRequest('/reservations/1/cancel', {
      method: 'POST',
      body: { reason: 'anon' },
    });
    assert.equal(anonCancel.status, 401);

    const userA = await createDisposableCustomer({ prefix: 't2f1304a' });
    const userB = await createDisposableCustomer({ prefix: 't2f1304b' });
    const slot = futureReservationSlot(13, 19, 0);
    try {
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

      const cancelByB = await apiRequest(`/reservations/${rsvA.reservationId}/cancel`, {
        method: 'POST',
        token: userB.accessToken,
        body: { reason: 'IDOR attempt' },
      });
      assert.equal(cancelByB.status, 403);
    } finally {
      userA.cleanup();
      userB.cleanup();
    }
  });

  it('T2-F13-05: Guest Count 1..16 & Mobile Grid Fit at 375x812 without overlap or overflow', async () => {
    const slot = futureReservationSlot(14, 19, 0);
    await withPage({ viewport: VIEWPORTS.IPHONE_375 }, async (page) => {
      await gotoRoute(page, '/reservation');
      await page.locator('input[type="date"]').fill(slot.dateStr);
      await page.getByRole('button', { name: /Tiếp tục: Chọn khu vực bàn/i }).click();
      await page.getByRole('button', { name: /Tiếp tục: Số lượng khách/i }).click();

      const guestBtns = page.getByRole('button', { name: /^\d+ người$/ });
      const count = await guestBtns.count();
      assert.equal(count, 10, `Expected 10 guest count buttons, got ${count}`);
      for (let i = 0; i < count; i++) {
        const box = await guestBtns.nth(i).boundingBox();
        assert.ok(box && box.x + box.width <= 375 + 1, `Guest button ${i} overflows 375px width`);
      }
      await assertNoHorizontalOverflow(page, 'Reservation Step 3 @ 375x812');
    });
  });
});

describe('Tier 2 — F14 Boundaries: Review Integrity & RBAC', () => {
  it('T2-F14-01: Unpurchased Dish Review Rejected with 400', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1401' });
    try {
      const snap = await getCatalogSnapshot();
      const res = await apiRequest('/reviews', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: snap.dishes[0].dishId, orderId: 999999, rating: 5, comment: 'Never bought' },
      });
      assert.equal(res.status, 400);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F14-02: Pending/Uncompleted Order Review Rejected with 400', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1402' });
    try {
      const snap = await getCatalogSnapshot();
      const dish = snap.dishes[0];
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

      const rev = await apiRequest('/reviews', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, orderId: order.orderId, rating: 5, comment: 'Not completed yet' },
      });
      assert.equal(rev.status, 400);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F14-03: Duplicate Review for Same Order+Dish rejected with 400/409', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1403' });
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
      await apiRequest('/payments/cash-confirm', {
        method: 'POST',
        token: staff.accessToken,
        body: { transactionNumber: detail.paymentTransactions[0].transactionNumber },
      });

      const first = await apiRequest('/reviews', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, orderId: order.orderId, rating: 5, comment: 'First review' },
      });
      assert.equal(first.status, 201);

      const dup = await apiRequest('/reviews', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: dish.dishId, orderId: order.orderId, rating: 5, comment: 'Duplicate review' },
      });
      assert.ok([400, 409].includes(dup.status), `Expected 400/409 duplicate review, got ${dup.status}`);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F14-04: Rating Out of Range 0 or 6 rejected with 400', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1404' });
    try {
      const r0 = await apiRequest('/reviews', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: 1, orderId: 1, rating: 0, comment: 'Bad rating' },
      });
      assert.equal(r0.status, 400);

      const r6 = await apiRequest('/reviews', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: 1, orderId: 1, rating: 6, comment: 'Too high' },
      });
      assert.equal(r6.status, 400);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F14-05: Unauthenticated Submit (401) & Customer Moderation (403)', async () => {
    const customer = await getCachedSession('customer');

    const anonSubmit = await apiRequest('/reviews', {
      method: 'POST',
      body: { menuItemId: 1, orderId: 1, rating: 5, comment: 'Anon' },
    });
    assert.equal(anonSubmit.status, 401);

    const custApprove = await apiRequest('/reviews/1/approve', {
      method: 'PUT',
      token: customer.accessToken,
    });
    assert.equal(custApprove.status, 403);
  });
});

describe('Tier 2 — F15 Boundaries: Content, Modals & No Hardcoded Personas', () => {
  it('T2-F15-01: Blogs & Branches Data Sanity (all branches have https mapEmbedUrl)', async () => {
    const [branchesRes, blogsRes] = await Promise.all([apiRequest('/branches'), apiRequest('/blogs')]);
    assert.equal(branchesRes.status, 200);
    assert.equal(blogsRes.status, 200);
    for (const b of branchesRes.data) {
      assert.ok(String(b.mapEmbedUrl || '').startsWith('https://'), `Branch ${b.name} missing https mapEmbedUrl`);
    }
    for (const post of blogsRes.data) {
      assert.ok(post.title && post.content, 'Published blog post must have title and content');
    }
  });

  it('T2-F15-02: Blog Reader Modal Long Content Scroll fits within 1280x800 & 375x812', async () => {
    for (const vp of [VIEWPORTS.DESKTOP_1280, VIEWPORTS.IPHONE_375]) {
      await withPage({ viewport: vp }, async (page) => {
        await gotoRoute(page, '/blog');
        await page.getByRole('button', { name: /Đọc bài viết/i }).first().click();

        const closeBtn = page.getByRole('button', { name: 'Đóng Bài Viết' });
        await closeBtn.waitFor({ state: 'visible' });
        const modalCard = closeBtn.locator('xpath=ancestor::div[contains(@class,"rounded")]').first();
        const cardBox = await modalCard.boundingBox();
        assert.ok(cardBox && cardBox.y >= -1 && cardBox.y + cardBox.height <= vp.height + 1, `Blog modal clipped on ${vp.width}x${vp.height}`);
        await closeBtn.click();
      });
    }
  });

  it('T2-F15-03: AboutPage Head Chef Badge stays within 375px mobile bounds', async () => {
    await withPage({ viewport: VIEWPORTS.IPHONE_375 }, async (page) => {
      await gotoRoute(page, '/about');
      const badge = page.getByText('Kinh nghiệm Ginza').first();
      await badge.waitFor({ state: 'visible' });
      const box = await badge.boundingBox();
      assert.ok(box && box.x + box.width <= 375 + 1, `Chef badge overflows 375px: right=${box?.x + box?.width}`);
      await assertNoHorizontalOverflow(page, '/about @ 375x812');
    });
  });

  it('T2-F15-04: Zero Hardcoded Personal Defaults on /reservation and /checkout', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f1504' });
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
        await gotoRoute(page, '/reservation');
        await page.getByRole('button', { name: /Tiếp tục: Chọn khu vực bàn/i }).click();
        await page.getByRole('button', { name: /Tiếp tục: Số lượng khách/i }).click();
        await page.getByRole('button', { name: /Tiếp tục: Thông tin người đặt/i }).click();

        const bodyValues = await page.locator('form input').evaluateAll((els) => els.map((e) => e.value));
        assert.ok(!bodyValues.includes('Nguyễn Minh Tuấn'), 'Hardcoded demo name "Nguyễn Minh Tuấn" must not be pre-filled');
      });

      const snap = await getCatalogSnapshot();
      await apiRequest('/cart/items', {
        method: 'POST',
        token: disp.accessToken,
        body: { menuItemId: snap.dishes[0].dishId, quantity: 1, modifierOptionIds: [] },
      });

      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, authSession: disp }, async (page) => {
        await gotoRoute(page, '/checkout');
        const vals = await page.locator('form input').evaluateAll((els) => els.map((e) => e.value));
        assert.ok(!vals.includes('Trần Hoàng Long'), 'Hardcoded demo name "Trần Hoàng Long" must not be pre-filled');
        assert.ok(
          !vals.some((v) => v.includes('Số 88 Đường Đồng Khởi')),
          'Hardcoded demo address "Số 88 Đường Đồng Khởi" must not be pre-filled'
        );
      });
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F15-05: 404 Nested Unknown Path renders NotFoundPage cleanly', async () => {
    await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
      await gotoRoute(page, '/menu/unknown/deep/path');
      await page.getByRole('heading', { name: /404 - Không Tìm Thấy Trang/i }).waitFor({ state: 'visible' });
    });
  });
});
