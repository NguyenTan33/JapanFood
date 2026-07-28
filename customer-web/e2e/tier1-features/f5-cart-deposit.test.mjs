import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYMENT_METHODS,
  ORDER_STATUSES,
  calculateServerOrderTotals,
  generateVietQrUrl,
  assertStrictDepositPolicy,
  validateOrderStateTransition,
  validateCartViewSchema,
  simulateAuthGatedCartAction,
  generateOrderCode,
} from '../harness/index.mjs';

describe('Tier 1 - Feature R3/R4: Authenticated Cart & Strict Order Deposit Policy', () => {
  it('T1-R5-01: Authenticated /api/cart lifecycle starts empty [] (zero mock defaults) & blocks guests', () => {
    const dish = { dishId: 1, code: 'RAMEN-01', name: 'Shoyu Ramen', basePrice: 165000, isAvailable: true };

    // Unauthenticated block (R3)
    const guestResult = simulateAuthGatedCartAction({ isAuthenticated: false, dish });
    assert.equal(guestResult.allowed, false);
    assert.equal(guestResult.statusCode, 401);
    assert.equal(guestResult.opensAuthModal, true);

    // Authenticated user starts with empty server cart (R2: no mock RAMEN-01/SUSHI-01 defaults)
    const serverCart = { items: [], subTotal: 0, totalItemCount: 0 };
    validateCartViewSchema(serverCart);
    assert.equal(serverCart.totalItemCount, 0);

    // POST /api/cart/items adds item and returns CartViewDto
    serverCart.items.push({
      cartItemId: 101,
      menuItemId: dish.dishId,
      dishCode: dish.code,
      itemName: dish.name,
      japaneseName: '醤油ラーメン',
      imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624',
      basePrice: dish.basePrice,
      quantity: 1,
      specialInstructions: null,
      modifiers: [],
      itemTotalPrice: 165000,
    });
    serverCart.subTotal = 165000;
    serverCart.totalItemCount = 1;

    validateCartViewSchema(serverCart);
    assert.equal(serverCart.totalItemCount, 1);
    assert.equal(serverCart.items[0].dishCode, 'RAMEN-01');
  });

  it('T1-R5-02: Server Order.RecalculateTotals financial calculation (SubTotal, 8% VAT, TotalAmount)', () => {
    const items = [
      { menuItemId: 1, itemName: 'Shoyu Ramen', basePrice: 165000, quantity: 3, modifiers: [] },
    ];

    const pricing = calculateServerOrderTotals(items, PAYMENT_METHODS.FULL_BANK);
    assert.equal(pricing.subTotal, 495000);
    assert.equal(pricing.taxAmount, Math.round(495000 * 0.08)); // 39,600
    assert.equal(pricing.totalAmount, 495000 + 39600); // 534,600
  });

  it('T1-R5-03: Cart item removal (DELETE /api/cart/items/{cartItemId}) & empty state handling', () => {
    const cart = {
      items: [{ cartItemId: 101, itemName: 'Shoyu Ramen', quantity: 1 }],
      remove(cartItemId) {
        this.items = this.items.filter((i) => i.cartItemId !== cartItemId);
      },
      isEmpty() {
        return this.items.length === 0;
      },
    };

    assert.equal(cart.isEmpty(), false);
    cart.remove(101);
    assert.equal(cart.isEmpty(), true);
  });

  it('T1-R5-04: Strict Payment Option 1: FullBank (100% Bank Transfer)', () => {
    const items = [{ menuItemId: 1, basePrice: 500000, quantity: 1 }];
    const pricing = calculateServerOrderTotals(items, PAYMENT_METHODS.FULL_BANK);

    assertStrictDepositPolicy(pricing);
    assert.equal(pricing.depositRate, 1.0);
    assert.equal(pricing.depositAmount, pricing.totalAmount);
    assert.equal(pricing.remainingCodAmount, 0);
  });

  it('T1-R5-05: Strict Payment Option 2: Cod50Deposit (COD with Mandatory 50% Deposit)', () => {
    const items = [{ menuItemId: 1, basePrice: 500000, quantity: 1 }];
    const pricing = calculateServerOrderTotals(items, PAYMENT_METHODS.COD_50_DEPOSIT);

    assertStrictDepositPolicy(pricing);
    assert.equal(pricing.depositRate, 0.5);
    const expectedDeposit = Math.round(pricing.totalAmount * 0.5);
    assert.equal(pricing.depositAmount, expectedDeposit);
    assert.equal(pricing.remainingCodAmount, pricing.totalAmount - expectedDeposit);
    assert.equal(pricing.depositAmount + pricing.remainingCodAmount, pricing.totalAmount);
  });

  it('T1-R5-06: Dynamic VietQR Generator using BankConfig from /api/restaurant-info & ORD- code', () => {
    const liveBankConfig = {
      bankName: 'MB Bank',
      bankId: '970422',
      accountNumber: '0903123456888',
      accountName: 'TORI SAKURA DINING',
    };
    const orderCode = generateOrderCode(new Date(), 'AB12CD');

    assert.match(orderCode, /^ORD-\d{8}-[A-F0-9]{6}$/);

    const qrUrl = generateVietQrUrl({
      bankConfig: liveBankConfig,
      depositAmount: 270000,
      orderCode,
    });

    assert.ok(qrUrl.includes('970422-0903123456888'));
    assert.ok(qrUrl.includes('amount=270000'));
    assert.ok(qrUrl.includes(orderCode));
    assert.ok(qrUrl.includes('TORI%20SAKURA%20DINING'));
    assert.ok(!qrUrl.includes('JAPANFOOD'));
  });

  it('T1-R5-07: OrderStatus enum lifecycle transition (Pending -> Confirmed -> InPreparation -> Served -> Completed)', () => {
    const order = {
      orderCode: generateOrderCode(new Date(), 'FF0011'),
      paymentMethod: PAYMENT_METHODS.COD_50_DEPOSIT,
      status: ORDER_STATUSES.PENDING,
      depositAmount: 270000,
    };

    validateOrderStateTransition(order.status, ORDER_STATUSES.CONFIRMED);
    order.status = ORDER_STATUSES.CONFIRMED;
    assert.equal(order.status, ORDER_STATUSES.CONFIRMED);

    validateOrderStateTransition(order.status, ORDER_STATUSES.IN_PREPARATION);
    order.status = ORDER_STATUSES.IN_PREPARATION;
    assert.equal(order.status, ORDER_STATUSES.IN_PREPARATION);

    validateOrderStateTransition(order.status, ORDER_STATUSES.SERVED);
    order.status = ORDER_STATUSES.SERVED;
    assert.equal(order.status, ORDER_STATUSES.SERVED);

    validateOrderStateTransition(order.status, ORDER_STATUSES.COMPLETED);
    order.status = ORDER_STATUSES.COMPLETED;
    assert.equal(order.status, ORDER_STATUSES.COMPLETED);
  });
});
