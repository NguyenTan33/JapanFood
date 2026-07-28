import assert from 'node:assert/strict';

export const BRAND_NAME = 'TORI SAKURA JAPANESE DINING';

export const API_BASE_PREFIX = '/api';

export const PUBLIC_ALLOW_ANONYMOUS_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/forgot-password',
  '/api/auth/verify-forgot-password-otp',
  '/api/auth/reset-password',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/menu/categories',
  '/api/menu/dishes',
  '/api/branches',
  '/api/blogs',
  '/api/reviews',
  '/api/vouchers',
  '/api/reservations/areas',
  '/api/restaurant-info',
];

export const AUTH_REQUIRED_ENDPOINTS = [
  '/api/auth/me',
  '/api/cart',
  '/api/cart/items',
  '/api/vouchers/apply',
  '/api/orders',
  '/api/orders/my-history',
  '/api/reservations/my-history',
];

export function validateErrorEnvelope(payload, expectedStatus) {
  assert.ok(payload && typeof payload === 'object', 'Error envelope must be JSON object');
  assert.equal(typeof payload.statusCode, 'number', 'Error envelope must include numeric statusCode');
  if (expectedStatus !== undefined) {
    assert.equal(payload.statusCode, expectedStatus, `Expected statusCode ${expectedStatus}`);
  }
  assert.ok(typeof payload.code === 'string' && payload.code.length > 0, 'Error envelope must include string code');
  assert.ok(typeof payload.message === 'string' && payload.message.length > 0, 'Error envelope must include string message');
}

export function simulateAuthGatedCartAction({ isAuthenticated, dish }) {
  if (!isAuthenticated) {
    return {
      allowed: false,
      statusCode: 401,
      opensAuthModal: true,
      errorEnvelope: {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Vui lòng đăng nhập để thêm món hoặc thao tác giỏ hàng',
      },
    };
  }

  if (dish && dish.isAvailable === false) {
    return {
      allowed: false,
      statusCode: 400,
      opensAuthModal: false,
      reason: 'Món ăn tạm hết hoặc ngừng phục vụ',
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    opensAuthModal: false,
  };
}

export function validateNoDemoBypassSource(sourceContent, fileLabel = 'source') {
  const forbiddenPatterns = [
    { pattern: /PRESET_ACCOUNTS/i, label: 'PRESET_ACCOUNTS' },
    { pattern: /Demo\s*Khách\s*VIP/i, label: 'Demo Khách VIP' },
    { pattern: /vip\.guest@japanfood\.vn/i, label: 'vip.guest@japanfood.vn' },
    { pattern: /customer\.gold@japanfood\.vn/i, label: 'customer.gold@japanfood.vn' },
    { pattern: /mockUsers/i, label: 'mockUsers' },
  ];

  for (const { pattern, label } of forbiddenPatterns) {
    assert.ok(
      !pattern.test(sourceContent),
      `R2/R3 violation in ${fileLabel}: forbidden demo bypass token "${label}" detected`
    );
  }
}

export function generateOrderCode(date = new Date(), suffix = 'A1B2C3') {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `ORD-${yyyy}${mm}${dd}-${suffix.toUpperCase()}`;
}
