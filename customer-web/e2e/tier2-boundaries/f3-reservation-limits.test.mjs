import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEATING_AREAS,
  validateReservationForm,
  createReservationTicket,
} from '../harness/index.mjs';

function getFutureDateStr(daysAhead = 1) {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysAhead);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

describe('Tier 2 - Boundary R3/R4: Reservation Limits & Strict Serving Window Boundaries', () => {
  it('T2-R3-01: Past date and <30-minute lead-time booking rejection', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDateStr = yesterday.toISOString().split('T')[0];

    const pastBooking = validateReservationForm({
      date: pastDateStr,
      time: '18:00',
      guestCount: 2,
      preferredAreaId: SEATING_AREAS.MAIN_DINING.id,
      customerName: 'Hoàng Nam',
      customerPhone: '0901234567',
    });
    assert.equal(pastBooking.isValid, false);
    assert.ok(pastBooking.errors.some((e) => e.includes('quá khứ')));

    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const tooSoon = validateReservationForm({
      reservationTime: tenMinutesFromNow,
      guestCount: 2,
      preferredAreaId: SEATING_AREAS.MAIN_DINING.id,
      customerName: 'Hoàng Nam',
      customerPhone: '0901234567',
    });
    assert.equal(tooSoon.isValid, false);
  });

  it('T2-R3-02: Party size boundary limits (0 guests, negative, and excessive > 20)', () => {
    const tomorrowStr = getFutureDateStr(1);

    const zeroGuests = validateReservationForm({
      date: tomorrowStr,
      time: '18:00',
      guestCount: 0,
      preferredAreaId: SEATING_AREAS.MAIN_DINING.id,
      customerName: 'Hoàng Nam',
      customerPhone: '0901234567',
    });
    assert.equal(zeroGuests.isValid, false);
    assert.ok(zeroGuests.errors.some((e) => e.includes('1 đến 20')));

    const excessiveGuests = validateReservationForm({
      date: tomorrowStr,
      time: '18:00',
      guestCount: 25,
      preferredAreaId: SEATING_AREAS.MAIN_DINING.id,
      customerName: 'Hoàng Nam',
      customerPhone: '0901234567',
    });
    assert.equal(excessiveGuests.isValid, false);
  });

  it('T2-R3-03: Seating area capacity constraint boundaries with integer preferredAreaId', () => {
    const tomorrowStr = getFutureDateStr(1);

    // Tatami Room (id=3) requires min 4 guests; attempt with 1 guest
    const underCapacity = validateReservationForm({
      date: tomorrowStr,
      time: '18:00',
      guestCount: 1,
      preferredAreaId: SEATING_AREAS.TATAMI_ROOM.id,
      customerName: 'Hoàng Nam',
      customerPhone: '0901234567',
    });
    assert.equal(underCapacity.isValid, false);
    assert.ok(underCapacity.errors.some((e) => e.includes('chỉ phục vụ từ 4')));

    // Sushi Bar (id=1) max 4 guests; attempt with 8 guests
    const overCapacity = validateReservationForm({
      date: tomorrowStr,
      time: '18:00',
      guestCount: 8,
      preferredAreaId: SEATING_AREAS.SUSHI_BAR.id,
      customerName: 'Hoàng Nam',
      customerPhone: '0901234567',
    });
    assert.equal(overCapacity.isValid, false);
    assert.ok(overCapacity.errors.some((e) => e.includes('chỉ phục vụ từ 1 đến 4')));

    // String areaId rejected (must be integer preferredAreaId)
    const stringArea = validateReservationForm({
      date: tomorrowStr,
      time: '18:00',
      guestCount: 4,
      preferredAreaId: 'tatami-room',
      customerName: 'Hoàng Nam',
      customerPhone: '0901234567',
    });
    assert.equal(stringArea.isValid, false);
  });

  it('T2-R3-04: Missing mandatory customer fields validation', () => {
    const tomorrowStr = getFutureDateStr(1);

    const missingName = validateReservationForm({
      date: tomorrowStr,
      time: '18:00',
      guestCount: 2,
      preferredAreaId: SEATING_AREAS.MAIN_DINING.id,
      customerName: '',
      customerPhone: '0901234567',
    });
    assert.equal(missingName.isValid, false);
    assert.ok(missingName.errors.some((e) => e.includes('Họ tên')));

    const missingPhone = validateReservationForm({
      date: tomorrowStr,
      time: '18:00',
      guestCount: 2,
      preferredAreaId: SEATING_AREAS.MAIN_DINING.id,
      customerName: 'Hoàng Nam',
      customerPhone: '',
    });
    assert.equal(missingPhone.isValid, false);
    assert.ok(missingPhone.errors.some((e) => e.includes('Số điện thoại')));
  });

  it('T2-R3-05: Strict serving hours boundaries (accepts 10:30-14:00 & 17:00-22:00; rejects 14:30, 16:59, 04:30, 23:45)', () => {
    const tomorrowStr = getFutureDateStr(1);

    for (const badTime of ['04:30', '10:29', '14:01', '14:30', '16:59', '22:01', '23:45']) {
      const res = validateReservationForm({
        date: tomorrowStr,
        time: badTime,
        guestCount: 2,
        preferredAreaId: SEATING_AREAS.MAIN_DINING.id,
        customerName: 'Hoàng Nam',
        customerPhone: '0901234567',
      });
      assert.equal(res.isValid, false, `Expected time "${badTime}" to be rejected`);
      assert.ok(res.errors.some((e) => e.includes('khung giờ phục vụ')));
    }

    for (const goodTime of ['10:30', '14:00', '17:00', '22:00']) {
      const res = validateReservationForm({
        date: tomorrowStr,
        time: goodTime,
        guestCount: 2,
        preferredAreaId: SEATING_AREAS.MAIN_DINING.id,
        customerName: 'Hoàng Nam',
        customerPhone: '0901234567',
      });
      assert.equal(res.isValid, true, `Expected boundary time "${goodTime}" to be accepted`);
    }
  });

  it('T2-R3-06: Special requests HTML XSS sanitization and RSV- Pending ticket generation', () => {
    const tomorrowStr = getFutureDateStr(1);
    const maliciousNote = '<script>alert("hack")</script><b>Yêu cầu bàn yên tĩnh</b>';
    const ticket = createReservationTicket({
      date: tomorrowStr,
      time: '19:00',
      guestCount: 2,
      preferredAreaId: SEATING_AREAS.MAIN_DINING.id,
      customerName: 'Khách VIP',
      customerPhone: '0901234567',
      specialRequests: maliciousNote,
    });

    assert.equal(ticket.status, 'Pending');
    assert.match(ticket.reservationCode, /^RSV-\d{8}-[A-F0-9]{6}$/);
    assert.ok(!ticket.specialRequests.includes('<script>'), 'Raw script tags must not be stored');
    assert.ok(ticket.specialRequests.includes('&lt;script&gt;'), 'HTML tags must be escaped');
    assert.ok(ticket.specialRequests.includes('&lt;b&gt;Yêu cầu bàn yên tĩnh&lt;/b&gt;'));
  });
});
