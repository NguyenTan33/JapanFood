import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND_NAME,
  SEATING_AREAS,
  validateReservationForm,
  createReservationTicket,
  validateReservationSchema,
  simulateAuthGatedCartAction,
} from '../harness/index.mjs';

function getFutureDateStr(daysAhead = 1) {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysAhead);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

describe('Tier 1 - Feature R3/R4: Homepage & Online Table Reservation', () => {
  it('T1-R3-01: Homepage cultural hero banner & TORI SAKURA brand presentation contract', () => {
    const heroContract = {
      brandName: BRAND_NAME,
      headline: 'Tinh Hoa Nghệ Thuật Ẩm Thực Nhật Bản',
      japaneseSub: '日本の本物の味 - Omotenashi & Wabi-Sabi',
      ctaButtons: [
        { label: 'Đặt bàn online', href: '/reservation', primary: true },
        { label: 'Khám phá thực đơn', href: '/menu', primary: false },
      ],
      philosophyTeaser: 'Mỗi món ăn là một tác phẩm được chuẩn bị với lòng hiếu khách tuyệt đối (Omotenashi).',
    };

    assert.equal(heroContract.brandName, 'TORI SAKURA JAPANESE DINING');
    assert.ok(heroContract.headline.includes('Ẩm Thực Nhật Bản'));
    assert.equal(heroContract.ctaButtons[0].href, '/reservation');
    assert.equal(heroContract.ctaButtons[1].href, '/menu');
    assert.ok(heroContract.philosophyTeaser.includes('Omotenashi'));
  });

  it('T1-R3-02: Table reservation date, ISO reservationTime & strict service hours selection', () => {
    const dateStr = getFutureDateStr(1);

    const validBooking = {
      date: dateStr,
      time: '18:30',
      guestCount: 4,
      preferredAreaId: SEATING_AREAS.MAIN_DINING.id,
      customerName: 'Nguyễn Hải Đăng',
      customerPhone: '0903456789',
    };

    const validation = validateReservationForm(validBooking);
    assert.ok(validation.isValid, 'Valid date and time should pass validation');
    assert.equal(validation.errors.length, 0);
    assert.ok(validation.isoReservationTime);
  });

  it('T1-R3-03: Seating area selection using integer preferredAreaId & dynamic future date', () => {
    const area = SEATING_AREAS.TATAMI_ROOM;
    assert.equal(area.id, 3);
    assert.equal(area.code, 'tatami-room');
    assert.ok(area.minGuests <= 4 && 4 <= area.maxGuests);

    const booking = {
      date: getFutureDateStr(3),
      time: '19:00',
      guestCount: 4,
      preferredAreaId: area.id,
      customerName: 'Trần Văn Bình',
      customerPhone: '0912334455',
    };

    const res = validateReservationForm(booking);
    assert.ok(res.isValid);
  });

  it('T1-R3-04: Guest contact information submission and note sanitization', () => {
    const guestInput = {
      date: getFutureDateStr(1),
      time: '12:00',
      guestCount: 2,
      preferredAreaId: SEATING_AREAS.SUSHI_BAR.id,
      customerName: 'Lê Hoàng Nam',
      customerPhone: '0988776655',
      customerEmail: 'nam.le@example.com',
      specialRequests: 'Yêu cầu ghế em bé và chuẩn bị bàn view quầy chef',
    };

    const validation = validateReservationForm(guestInput);
    assert.ok(validation.isValid);
    assert.equal(validation.sanitizedRequests, guestInput.specialRequests);
  });

  it('T1-R3-05: Reservation confirmation ticket issuance matching RSV-yyyyMMdd-XXXXXX & Pending status', () => {
    const ticket = createReservationTicket({
      date: getFutureDateStr(2),
      time: '19:30',
      guestCount: 6,
      preferredAreaId: SEATING_AREAS.TATAMI_ROOM.id,
      customerName: 'Vũ Quốc Hưng',
      customerPhone: '0977889900',
      specialRequests: 'Tiệc kỷ niệm ngày cưới',
    });

    validateReservationSchema(ticket);
    assert.ok(ticket.reservationCode.startsWith('RSV-'), 'Reservation code must start with RSV-');
    assert.match(ticket.reservationCode, /^RSV-\d{8}-[A-F0-9]{6}$/, 'Format must match RSV-yyyyMMdd-XXXXXX');
    assert.equal(ticket.status, 'Pending');
    assert.equal(ticket.depositStatus, 'Pending');
    assert.equal(ticket.preferredAreaId, 3);
    assert.equal(ticket.guestCount, 6);
  });

  it('T1-R3-06: Homepage Bestsellers add-to-cart enforces R3 authentication gate', () => {
    const bestsellerDish = {
      dishId: 1,
      code: 'SUSHI-BOAT-01',
      name: 'Thuyền Sushi & Sashimi Thượng Hạng',
      basePrice: 750000,
      isFeatured: true,
      isAvailable: true,
    };

    // Unauthenticated user must be blocked (401 + AuthModal prompt)
    const guestAttempt = simulateAuthGatedCartAction({ isAuthenticated: false, dish: bestsellerDish });
    assert.equal(guestAttempt.allowed, false);
    assert.equal(guestAttempt.statusCode, 401);
    assert.equal(guestAttempt.opensAuthModal, true);

    // Authenticated user succeeds via /api/cart/items
    const authAttempt = simulateAuthGatedCartAction({ isAuthenticated: true, dish: bestsellerDish });
    assert.equal(authAttempt.allowed, true);
    assert.equal(authAttempt.statusCode, 200);
  });
});
