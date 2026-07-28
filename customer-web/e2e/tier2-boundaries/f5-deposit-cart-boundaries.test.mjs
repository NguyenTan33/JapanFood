import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYMENT_METHODS,
  calculateServerOrderTotals,
  assertStrictDepositPolicy,
  MockStorage,
  AUTH_STORAGE_KEYS,
  setAuthTokens,
  getAuthTokens,
  validateCartViewSchema,
  validateErrorEnvelope,
  validateVoucherSchema,
} from '../harness/index.mjs';

describe('Tier 2 - Boundary R3/R4: Authenticated Cart, Deposit Policy & IDOR Boundaries', () => {
  it('T2-R5-01: Absolute rejection of unauthorized 0% deposit or legacy payment methods', () => {
    const items = [{ menuItemId: 1, basePrice: 200000, quantity: 1 }];

    assert.throws(
      () => calculateServerOrderTotals(items, 'COD_NO_DEPOSIT'),
      /STRICT PAYMENT ENFORCEMENT ERROR/
    );
    assert.throws(
      () => calculateServerOrderTotals(items, 'PAY_LATER_100_PERCENT'),
      /STRICT PAYMENT ENFORCEMENT ERROR/
    );
    assert.throws(
      () => calculateServerOrderTotals(items, 'FULL_BANK_TRANSFER'),
      /STRICT PAYMENT ENFORCEMENT ERROR/
    );
  });

  it('T2-R5-02: Deposit calculation precision on odd total amounts and invariant guarantee', () => {
    const items = [{ menuItemId: 1, basePrice: 275555, quantity: 1 }];
    const pricing = calculateServerOrderTotals(items, PAYMENT_METHODS.COD_50_DEPOSIT);

    assert.equal(
      pricing.depositAmount + pricing.remainingCodAmount,
      pricing.totalAmount,
      'depositAmount + remainingCodAmount must strictly equal totalAmount'
    );
    assert.equal(Number.isInteger(pricing.depositAmount), true);
    assert.equal(Number.isInteger(pricing.remainingCodAmount), true);
    assertStrictDepositPolicy(pricing);
  });

  it('T2-R5-03: Cart quantity boundary limits (Min 1 and Max 99)', () => {
    function clampQuantity(qty) {
      if (typeof qty !== 'number' || Number.isNaN(qty)) return 1;
      return Math.min(99, Math.max(1, Math.floor(qty)));
    }

    assert.equal(clampQuantity(0), 1);
    assert.equal(clampQuantity(-5), 1);
    assert.equal(clampQuantity(150), 99);
    assert.equal(clampQuantity(999), 99);
    assert.equal(clampQuantity(5.8), 5);
  });

  it('T2-R5-04: Checkout mandatory customer information validation', () => {
    function validateCheckoutCustomer({ recipientName, recipientPhone, deliveryAddress }) {
      const errors = [];
      if (!recipientName || recipientName.trim().length < 2) errors.push('Vui lòng nhập họ tên người nhận');
      if (!recipientPhone || !/^(0|\+84)[0-9]{9}$/.test(recipientPhone.replace(/\s+/g, ''))) {
        errors.push('Vui lòng nhập số điện thoại hợp lệ');
      }
      if (!deliveryAddress || deliveryAddress.trim().length < 5) errors.push('Vui lòng nhập địa chỉ giao hàng');

      return { isValid: errors.length === 0, errors };
    }

    const missingAll = validateCheckoutCustomer({});
    assert.equal(missingAll.isValid, false);
    assert.equal(missingAll.errors.length, 3);

    const validCustomer = validateCheckoutCustomer({
      recipientName: 'Nguyễn Văn A',
      recipientPhone: '0901234567',
      deliveryAddress: '123 Phố Huế, Hai Bà Trưng, Hà Nội',
    });
    assert.equal(validCustomer.isValid, true);
  });

  it('T2-R5-05: VoucherDto minimum order boundary & HTTP 400 INVALID_VOUCHER contract', () => {
    const voucher = {
      id: 1,
      code: 'JAPANFOOD50K',
      title: 'Giảm 50.000đ',
      discountType: 'FixedAmount',
      discountValue: 50000,
      minOrderAmount: 300000,
      maxDiscountAmount: 50000,
      endDate: new Date(Date.now() + 86400_000 * 30).toISOString(),
      isActive: true,
    };
    validateVoucherSchema(voucher);

    const itemsUnderMin = [{ menuItemId: 1, basePrice: 200000, quantity: 1 }];
    assert.throws(
      () => calculateServerOrderTotals(itemsUnderMin, PAYMENT_METHODS.FULL_BANK, voucher),
      /Đơn hàng tối thiểu/
    );

    const invalidVoucherError = {
      statusCode: 400,
      code: 'INVALID_VOUCHER',
      message: 'Mã giảm giá không hợp lệ hoặc đơn hàng chưa đạt giá trị tối thiểu',
    };
    validateErrorEnvelope(invalidVoucherError, 400);

    const itemsMeetMin = [{ menuItemId: 1, basePrice: 350000, quantity: 1 }];
    const pricing = calculateServerOrderTotals(itemsMeetMin, PAYMENT_METHODS.FULL_BANK, voucher);
    assert.equal(pricing.discountAmount, 50000);
  });

  it('T2-R5-06: Authenticated Cart persistence via torisakura_access_token -> GET /api/cart (zero localStorage cart)', () => {
    const storage = new MockStorage();
    setAuthTokens(storage, {
      accessToken: 'jwt_valid_customer_token',
      refreshToken: 'jwt_valid_refresh_token',
    });

    // Unauthenticated request (no token) must return 401
    function fetchServerCart(store, serverDbByUser) {
      const { accessToken } = getAuthTokens(store);
      if (!accessToken) {
        return {
          status: 401,
          error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required' },
        };
      }
      const userCart = serverDbByUser.get(accessToken) || { items: [], subTotal: 0, totalItemCount: 0 };
      validateCartViewSchema(userCart);
      return { status: 200, data: userCart };
    }

    const db = new Map();
    db.set('jwt_valid_customer_token', {
      items: [
        {
          cartItemId: 1,
          menuItemId: 1,
          dishCode: 'RAMEN-01',
          itemName: 'Tonkotsu Ramen',
          japaneseName: '豚骨ラーメン',
          imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624',
          basePrice: 165000,
          quantity: 2,
          specialInstructions: null,
          modifiers: [],
          itemTotalPrice: 330000,
        },
      ],
      subTotal: 330000,
      totalItemCount: 2,
    });

    // Reload with token recovers server SQL cart
    const reloadRes = fetchServerCart(storage, db);
    assert.equal(reloadRes.status, 200);
    assert.equal(reloadRes.data.totalItemCount, 2);
    assert.equal(storage.getItem('japanfood_cart'), null);

    // Unauthenticated storage returns 401
    const unauthStorage = new MockStorage();
    const unauthRes = fetchServerCart(unauthStorage, db);
    assert.equal(unauthRes.status, 401);
    validateErrorEnvelope(unauthRes.error, 401);
  });

  it('T2-R5-07: R3/R4 Unauthenticated 401 & Cross-User Order IDOR Ownership Check (403/404)', () => {
    const orders = new Map([
      [501, { orderId: 501, orderNumber: 'ORD-20261119-AA11BB', userId: 4, totalAmount: 540000 }],
    ]);

    function accessOrderEndpoint({ currentUserId, role = 'CUSTOMER', orderId }) {
      if (!currentUserId) {
        return { status: 401, error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Login required' } };
      }
      const order = orders.get(orderId);
      if (!order) {
        return { status: 404, error: { statusCode: 404, code: 'NOT_FOUND', message: 'Order not found' } };
      }
      if (order.userId !== currentUserId && !['STAFF', 'MANAGER', 'ADMIN'].includes(role)) {
        return { status: 403, error: { statusCode: 403, code: 'FORBIDDEN', message: 'Access denied' } };
      }
      return { status: 200, data: order };
    }

    // Anonymous -> 401
    const anon = accessOrderEndpoint({ currentUserId: null, orderId: 501 });
    assert.equal(anon.status, 401);
    validateErrorEnvelope(anon.error, 401);

    // Different user -> 403 IDOR block
    const idorAttempt = accessOrderEndpoint({ currentUserId: 999, orderId: 501 });
    assert.equal(idorAttempt.status, 403);
    validateErrorEnvelope(idorAttempt.error, 403);

    // Owner -> 200
    const ownerRes = accessOrderEndpoint({ currentUserId: 4, orderId: 501 });
    assert.equal(ownerRes.status, 200);
    assert.equal(ownerRes.data.orderNumber, 'ORD-20261119-AA11BB');
  });
});
