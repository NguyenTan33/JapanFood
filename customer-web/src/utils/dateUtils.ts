/**
 * Tiện ích xử lý ngày tháng theo múi giờ địa phương của khách hàng (Local Timezone).
 * Khắc phục triệt để lỗi toISOString() bị lùi về ngày hôm qua khi ở múi giờ UTC+7 (Việt Nam).
 */

export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatVietnameseDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return dateStr;
};

export const isDateInPast = (dateStr: string): boolean => {
  const today = getLocalDateString();
  return dateStr < today;
};

export const formatVND = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount || 0);
};
