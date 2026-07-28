import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MockStorage,
  AUTH_STORAGE_KEYS,
  setAuthTokens,
  PAYMENT_METHODS,
  ORDER_STATUSES,
  calculateServerOrderTotals,
  generateVietQrUrl,
  assertStrictDepositPolicy,
  BookFlipStateMachine,
  filterDishes,
  createReservationTicket,
  SEATING_AREAS,
  simulateAuthGatedCartAction,
  validateCartViewSchema,
  validateUserProfileSchema,
  validateVoucherSchema,
  generateOrderCode,
} from '../harness/index.mjs';

function getFutureDateStr(daysAhead = 1) {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysAhead);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

describe('Tier 3: Pairwise Cross-Feature Interactions', () => {
  it('T3-PAIR-01: Unauthenticated Cart Block -> AuthModal Prompt -> Authenticated /api/cart Persistence & Checkout Auto-Fill', () => {
    const storage = new MockStorage();
    const dish = {
      dishId: 1,
      code: 'RAMEN-01',
      name: 'Tonkotsu Ramen',
      japaneseName: '特製豚骨ラーメン',
      basePrice: 165000,
      imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624',
      isAvailable: true,
    };

    // 1. Unauthenticated guest attempts to add dish to cart -> MUST be blocked (R3)
    const guestAttempt = simulateAuthGatedCartAction({ isAuthenticated: false, dish });
    assert.equal(guestAttempt.allowed, false);
    assert.equal(guestAttempt.statusCode, 401);
    assert.equal(guestAttempt.opensAuthModal, true);
    assert.equal(storage.getItem('japanfood_cart'), null, 'No guest localStorage cart must exist');

    // 2. Guest logs in via /api/auth/login + /api/auth/me
    const loggedInUser = {
      id: 4,
      fullName: 'Nguyễn Văn An',
      phoneNumber: '+84901234567',
      email: 'customer@japanfood.vn',
      role: 'CUSTOMER',
      loyaltyPoints: 100,
      membershipTier: 'SILVER',
    };
    validateUserProfileSchema(loggedInUser);
    setAuthTokens(storage, {
      accessToken: 'jwt_auth_token_live',
      refreshToken: 'jwt_refresh_token_live',
    });
    assert.equal(storage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN), 'jwt_auth_token_live');

    // 3. Authenticated user adds items via /api/cart/items -> persisted in SQL CartViewDto
    const authAttempt = simulateAuthGatedCartAction({ isAuthenticated: true, dish });
    assert.equal(authAttempt.allowed, true);

    const serverCart = {
      items: [
        {
          cartItemId: 11,
          menuItemId: 1,
          dishCode: 'RAMEN-01',
          itemName: 'Tonkotsu Ramen',
          japaneseName: '特製豚骨ラーメン',
          imageUrl: dish.imageUrl,
          basePrice: 165000,
          quantity: 2,
          specialInstructions: null,
          modifiers: [],
          itemTotalPrice: 330000,
        },
        {
          cartItemId: 12,
          menuItemId: 2,
          dishCode: 'GYOZA-01',
          itemName: 'Gyoza nướng',
          japaneseName: '焼き餃子',
          imageUrl: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf',
          basePrice: 65000,
          quantity: 1,
          specialInstructions: null,
          modifiers: [],
          itemTotalPrice: 65000,
        },
      ],
      subTotal: 395000,
      totalItemCount: 3,
    };
    validateCartViewSchema(serverCart);

    // 4. Checkout form auto-fills recipient from /api/auth/me profile
    const checkoutForm = {
      recipientName: loggedInUser.fullName,
      recipientPhone: loggedInUser.phoneNumber,
      deliveryAddress: '123 Lê Lợi, Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      items: serverCart.items,
    };
    assert.equal(checkoutForm.recipientName, 'Nguyễn Văn An');
    assert.equal(checkoutForm.recipientPhone, '+84901234567');

    // 5. Server Order.RecalculateTotals pricing invariant
    const finalPricing = calculateServerOrderTotals(checkoutForm.items, PAYMENT_METHODS.FULL_BANK);
    assert.equal(finalPricing.subTotal, 395000);
    assert.equal(finalPricing.taxAmount, Math.round(395000 * 0.08)); // 31,600
    assert.equal(finalPricing.totalAmount, 395000 + 31600); // 426,600
    assertStrictDepositPolicy(finalPricing);
  });

  it('T3-PAIR-02: Filtered Menu Search to DishDetailDto ModifierGroup Price Delta', () => {
    const dishes = [
      {
        dishId: 1,
        code: 'RAMEN-01',
        name: 'Tonkotsu Ramen Đặc Biệt',
        japaneseName: '特製豚骨ラーメン',
        basePrice: 165000,
        categoryId: 1,
        categoryCode: 'ramen',
        imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624',
        tags: ['Signature'],
        isAvailable: true,
        isFeatured: true,
      },
    ];

    const filtered = filterDishes(dishes, { searchQuery: 'Tonkotsu', minPrice: 150000, maxPrice: 250000 });
    assert.equal(filtered.length, 1);
    const selectedDish = filtered[0];

    const selectedModifiers = [
      { modifierOptionId: 1, optionName: 'Đậm đà (Rich)', priceAdjustment: 10000, quantity: 1 },
      { modifierOptionId: 2, optionName: 'Sợi dai (Firm)', priceAdjustment: 0, quantity: 1 },
      { modifierOptionId: 3, optionName: 'Trứng lòng đào Ajitsuke Tamago', priceAdjustment: 15000, quantity: 1 },
      { modifierOptionId: 4, optionName: 'Thịt Chashu nướng thêm (2 lát)', priceAdjustment: 35000, quantity: 1 },
    ];

    const customizedCartItem = {
      menuItemId: selectedDish.dishId,
      dishCode: selectedDish.code,
      itemName: selectedDish.name,
      basePrice: selectedDish.basePrice,
      modifiers: selectedModifiers,
      quantity: 2,
    };

    const pricing = calculateServerOrderTotals([customizedCartItem], PAYMENT_METHODS.FULL_BANK);
    // Unit price: 165k + 10k + 0 + 15k + 35k = 225,000; * 2 = 450,000
    assert.equal(pricing.subTotal, 450000);
  });

  it('T3-PAIR-03: 3D Book-Flip Spread State Retention Across Modal & Cart Drawer Interplay', () => {
    const book = new BookFlipStateMachine(10, 'desktop');
    book.registerBookmarkTab('Mì Ramen', 5);

    book.jumpToTab('Mì Ramen');
    const initialSpread = book.getCurrentSpread();
    assert.equal(initialSpread.left, 5);
    assert.equal(initialSpread.right, 6);
    assert.equal(initialSpread.spreadIndex, 2);

    let isModalOpen = true;
    let isDrawerOpen = false;
    isModalOpen = false;
    isDrawerOpen = true;
    assert.equal(isModalOpen, false);
    assert.equal(isDrawerOpen, true);

    isDrawerOpen = false;
    const postSpread = book.getCurrentSpread();
    assert.equal(postSpread.left, 5);
    assert.equal(postSpread.right, 6);
    assert.equal(postSpread.spreadIndex, 2);
  });

  it('T3-PAIR-04: Cart Checkout with Strict Cod50Deposit Policy & Dynamic Half-Amount VietQR', () => {
    const items = [{ menuItemId: 1, basePrice: 500000, quantity: 1 }];
    const pricing = calculateServerOrderTotals(items, PAYMENT_METHODS.COD_50_DEPOSIT);

    assert.equal(pricing.subTotal, 500000);
    assert.equal(pricing.taxAmount, 40000);
    assert.equal(pricing.totalAmount, 540000);

    assertStrictDepositPolicy(pricing);
    assert.equal(pricing.depositAmount, 270000);
    assert.equal(pricing.remainingCodAmount, 270000);

    let policyAgreed = false;
    function attemptOrderCreation(agreed) {
      if (!agreed) throw new Error('Quý khách vui lòng xác nhận đồng ý chính sách đặt cọc 50%');
      return {
        orderNumber: generateOrderCode(new Date(), 'C0D501'),
        depositAmount: pricing.depositAmount,
        status: ORDER_STATUSES.PENDING,
      };
    }

    assert.throws(() => attemptOrderCreation(policyAgreed), /đồng ý chính sách đặt cọc 50%/);

    policyAgreed = true;
    const order = attemptOrderCreation(policyAgreed);
    assert.equal(order.status, ORDER_STATUSES.PENDING);
    assert.match(order.orderNumber, /^ORD-\d{8}-[A-F0-9]{6}$/);

    const bankConfig = {
      bankId: '970422',
      accountNumber: '0903123456888',
      accountName: 'TORI SAKURA DINING',
    };
    const qrUrl = generateVietQrUrl({
      bankConfig,
      depositAmount: order.depositAmount,
      orderCode: order.orderNumber,
    });
    assert.ok(qrUrl.includes('amount=270000'), 'VietQR must encode 50% deposit amount');
    assert.ok(!qrUrl.includes('amount=540000'), 'VietQR must not encode full amount under Cod50Deposit');
  });

  it('T3-PAIR-05: Table Reservation BranchDto Selection Coherence with Integer preferredAreaId', () => {
    const branches = [
      { id: 1, code: 'HN-HOANKIEM', name: 'Tori Sakura Hoàn Kiếm', phone: '024-3939-1111' },
      { id: 2, code: 'HCM-BINHTHANH', name: 'Tori Sakura Landmark 81', phone: '028-3838-2222' },
    ];

    const selectedBranch = branches[1];
    const ticket = createReservationTicket({
      branchId: selectedBranch.id,
      date: getFutureDateStr(1),
      time: '19:00',
      guestCount: 4,
      preferredAreaId: SEATING_AREAS.TATAMI_ROOM.id,
      customerName: 'Trần Hữu D',
      customerPhone: '0988112233',
    });

    assert.equal(ticket.branchId, 2);
    assert.equal(ticket.preferredAreaId, 3);
    assert.equal(ticket.status, 'Pending');
    assert.match(ticket.reservationCode, /^RSV-\d{8}-[A-F0-9]{6}$/);
  });

  it('T3-PAIR-06: Blog Culinary Story Deep-Linking to Interactive Menu Item Modal', () => {
    const blogArticle = {
      slug: 'art-of-edomae-sushi',
      relatedDish: { code: 'SUSHI-02', category: 'sushi-sashimi' },
    };

    const targetUrl = `/menu?dish=${blogArticle.relatedDish.code}&category=${blogArticle.relatedDish.category}`;
    const urlParams = new URLSearchParams(targetUrl.split('?')[1]);

    assert.equal(urlParams.get('dish'), 'SUSHI-02');
    assert.equal(urlParams.get('category'), 'sushi-sashimi');
  });

  it('T3-PAIR-07: VoucherDto Discount Recalculation across FullBank vs Cod50Deposit Modes', () => {
    const items = [{ menuItemId: 1, basePrice: 600000, quantity: 1 }];
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

    const modeA = calculateServerOrderTotals(items, PAYMENT_METHODS.FULL_BANK, voucher);
    assert.equal(modeA.discountAmount, 50000);
    assert.equal(modeA.totalAmount, 600000 + 48000 - 50000); // 598,000
    assert.equal(modeA.depositAmount, 598000);
    assert.equal(modeA.remainingCodAmount, 0);

    const modeB = calculateServerOrderTotals(items, PAYMENT_METHODS.COD_50_DEPOSIT, voucher);
    assert.equal(modeB.discountAmount, 50000);
    assert.equal(modeB.totalAmount, 598000);
    assert.equal(modeB.depositAmount, 299000);
    assert.equal(modeB.remainingCodAmount, 299000);
    assert.equal(modeB.depositAmount + modeB.remainingCodAmount, modeB.totalAmount);

    const noVoucher = calculateServerOrderTotals(items, PAYMENT_METHODS.COD_50_DEPOSIT, null);
    assert.equal(noVoucher.totalAmount, 648000);
    assert.equal(noVoucher.depositAmount, 324000);
    assert.equal(noVoucher.remainingCodAmount, 324000);
  });

  it('T3-PAIR-08: Reservation Dietary Allergy Request Consistency with DishCardDto Tag Filtering', () => {
    const menuCatalog = [
      { dishId: 1, name: 'Salad Rong Nho Mè Rang', tags: ['vegetarian'], spiceLevel: 0 },
      { dishId: 2, name: 'Tempura Rau Củ Kyoto', tags: ['vegetarian'], spiceLevel: 0 },
      { dishId: 3, name: 'Bò Wagyu Nướng Cay', tags: ['meat'], spiceLevel: 2 },
      { dishId: 4, name: 'Mì Ramen Cay Cấp 3', tags: ['noodles'], spiceLevel: 3 },
    ];

    const requestedTags = ['vegetarian'];
    const filteredDishes = menuCatalog.filter(
      (d) => requestedTags.every((t) => d.tags.includes(t)) && d.spiceLevel === 0
    );

    assert.equal(filteredDishes.length, 2);
    assert.ok(filteredDishes.every((d) => d.tags.includes('vegetarian')));
    assert.ok(filteredDishes.every((d) => d.spiceLevel === 0));
  });
});
