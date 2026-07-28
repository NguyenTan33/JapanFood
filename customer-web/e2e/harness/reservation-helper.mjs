import { randomBytes } from 'node:crypto';

export const SEATING_AREAS = {
  SUSHI_BAR: {
    id: 1,
    code: 'sushi-bar',
    name: 'Quầy Omakase / Sushi Bar',
    minGuests: 1,
    maxGuests: 4,
    requiresDeposit: false,
  },
  MAIN_DINING: {
    id: 2,
    code: 'main-dining',
    name: 'Sảnh chính Wabi-Sabi (Sảnh Sakura)',
    minGuests: 1,
    maxGuests: 20,
    requiresDeposit: false,
  },
  TATAMI_ROOM: {
    id: 3,
    code: 'tatami-room',
    name: 'Phòng VIP Chiếu Tatami',
    minGuests: 4,
    maxGuests: 12,
    requiresDeposit: true,
  },
  VIP_ROOM: {
    id: 4,
    code: 'vip-room',
    name: 'Phòng Hoàng Gia (VIP Executive)',
    minGuests: 6,
    maxGuests: 16,
    requiresDeposit: true,
  },
};

export function sanitizeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resolveDateTimeParts({ reservationTime, date, time }) {
  if (reservationTime) {
    const dt = new Date(reservationTime);
    if (Number.isNaN(dt.getTime())) {
      return { valid: false };
    }
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const mon = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return {
      valid: true,
      dt,
      dateStr: `${yyyy}-${mon}-${dd}`,
      hour: dt.getHours(),
      minute: dt.getMinutes(),
      timeStr: `${hh}:${mm}`,
    };
  }

  if (!date || !time || !/^\d{2}:\d{2}$/.test(time)) {
    return { valid: false };
  }
  const [hour, minute] = time.split(':').map(Number);
  const dt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(dt.getTime())) {
    return { valid: false };
  }
  return {
    valid: true,
    dt,
    dateStr: date,
    hour,
    minute,
    timeStr: time,
  };
}

export function validateReservationForm({
  branchId = 1,
  reservationTime,
  date,
  time,
  guestCount,
  preferredAreaId,
  customerName,
  customerPhone,
  customerEmail,
  specialRequests = '',
}) {
  const errors = [];
  const parsed = resolveDateTimeParts({ reservationTime, date, time });
  const now = Date.now();
  const minAdvanceMs = 30 * 60 * 1000;

  if (!parsed.valid) {
    errors.push('Ngày giờ đặt bàn không hợp lệ');
  } else {
    if (parsed.dt.getTime() <= now) {
      errors.push('Ngày đặt bàn không thể là thời điểm trong quá khứ');
    } else if (parsed.dt.getTime() < now + minAdvanceMs) {
      errors.push('Thời gian đặt bàn phải trước ít nhất 30 phút');
    }

    const totalMinutes = parsed.hour * 60 + parsed.minute;
    const isLunch = totalMinutes >= 10 * 60 + 30 && totalMinutes <= 14 * 60;
    const isDinner = totalMinutes >= 17 * 60 && totalMinutes <= 22 * 60;

    if (!isLunch && !isDinner) {
      errors.push('Giờ đặt bàn phải nằm trong khung giờ phục vụ của nhà hàng (10:30-14:00 hoặc 17:00-22:00)');
    }
  }

  const count = Number(guestCount);
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    errors.push('Số lượng khách phải từ 1 đến 20 người');
  }

  if (!Number.isInteger(preferredAreaId)) {
    errors.push('preferredAreaId phải là số nguyên hợp lệ');
  } else {
    const area = Object.values(SEATING_AREAS).find((a) => a.id === preferredAreaId);
    if (!area) {
      errors.push('Vui lòng chọn khu vực bàn hợp lệ');
    } else if (count < area.minGuests || count > area.maxGuests) {
      errors.push(`Khu vực ${area.name} chỉ phục vụ từ ${area.minGuests} đến ${area.maxGuests} khách`);
    }
  }

  if (!customerName || customerName.trim().length < 2) {
    errors.push('Họ tên khách hàng phải có ít nhất 2 ký tự');
  }

  const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
  const cleanPhone = (customerPhone || '').replace(/\s+/g, '');
  if (!customerPhone || !phoneRegex.test(cleanPhone)) {
    errors.push('Số điện thoại không đúng định dạng Việt Nam (10 chữ số)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    isoReservationTime: parsed.valid ? parsed.dt.toISOString() : null,
    sanitizedRequests: sanitizeHtml(specialRequests.slice(0, 500)),
  };
}

export function createReservationTicket(formData) {
  const validation = validateReservationForm(formData);
  if (!validation.isValid) {
    throw new Error('RESERVATION VALIDATION FAILED: ' + validation.errors.join('; '));
  }

  const parsed = resolveDateTimeParts(formData);
  const dateCompact = parsed.dateStr.replace(/[^0-9]/g, '');
  const hexSuffix = randomBytes(3).toString('hex').toUpperCase();
  const reservationCode = `RSV-${dateCompact}-${hexSuffix}`;
  const area = Object.values(SEATING_AREAS).find((a) => a.id === formData.preferredAreaId);

  return {
    reservationCode,
    status: 'Pending',
    depositStatus: area?.requiresDeposit ? 'Pending' : 'NotRequired',
    preferredAreaId: formData.preferredAreaId,
    reservationTime: validation.isoReservationTime,
    createdAt: new Date().toISOString(),
    branchId: formData.branchId ?? 1,
    customerName: formData.customerName,
    customerPhone: formData.customerPhone,
    customerEmail: formData.customerEmail ?? null,
    guestCount: Number(formData.guestCount),
    specialRequests: validation.sanitizedRequests,
  };
}
