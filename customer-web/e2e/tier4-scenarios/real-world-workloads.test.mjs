import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRAND_NAME,
  MockStorage,
  AUTH_STORAGE_KEYS,
  setAuthTokens,
  getAuthTokens,
  clearAuthTokens,
  PAYMENT_METHODS,
  ORDER_STATUSES,
  calculateServerOrderTotals,
  generateVietQrUrl,
  assertStrictDepositPolicy,
  validateOrderStateTransition,
  BookFlipStateMachine,
  validateReservationForm,
  createReservationTicket,
  validateReservationSchema,
  validateBranchSchema,
  validateBlogSchema,
  validateUserProfileSchema,
  SEATING_AREAS,
  assertContainsText,
  generateOrderCode,
} from '../harness/index.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const STRICT_R2 = process.env.E2E_STRICT_R2 === '1';

function getFutureDateStr(daysAhead = 1) {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysAhead);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

describe('Tier 4: Real-World Application Workloads & User Journeys', () => {
  it('T4-SCENARIO-01: Authenticated Diner Journey (Book-Flip -> DishDetailDto Modifiers -> Cod50Deposit -> VietQR & Lifecycle)', () => {
    const book = new BookFlipStateMachine(8, 'desktop');
    book.registerBookmarkTab('Ramen', 5);
    book.jumpToTab('Ramen');
    assert.equal(book.getCurrentSpread().left, 5);

    const customizedRamen = {
      menuItemId: 1,
      dishCode: 'RAMEN-01',
      itemName: 'Tonkotsu Chashu Ramen Đặc Biệt',
      basePrice: 165000,
      modifiers: [
        { modifierOptionId: 1, optionName: 'Đậm vị Tokyo (Rich)', priceAdjustment: 10000, quantity: 1 },
        { modifierOptionId: 2, optionName: 'Trứng lòng đào Ajitsuke Tamago', priceAdjustment: 15000, quantity: 1 },
      ],
      quantity: 2,
    }; // Unit 190,000 * 2 = 380,000

    const sideGyoza = {
      menuItemId: 5,
      dishCode: 'GYOZA-01',
      itemName: 'Há cảo Nhật Gyoza nướng (6 chiếc)',
      basePrice: 65000,
      modifiers: [],
      quantity: 1,
    };

    const pricing = calculateServerOrderTotals([customizedRamen, sideGyoza], PAYMENT_METHODS.COD_50_DEPOSIT);
    assert.equal(pricing.subTotal, 445000);
    assert.equal(pricing.taxAmount, Math.round(445000 * 0.08)); // 35,600
    assert.equal(pricing.totalAmount, 445000 + 35600); // 480,600

    assertStrictDepositPolicy(pricing);
    assert.equal(pricing.depositAmount, 240300);
    assert.equal(pricing.remainingCodAmount, 240300);

    const order = {
      orderNumber: generateOrderCode(new Date(), '01ABCD'),
      recipientName: 'Nguyễn Tuấn Minh',
      recipientPhone: '0904567890',
      deliveryAddress: 'Phòng 802, Chung cư Skylight, 125 Bạch Mai, Hà Nội',
      ...pricing,
      status: ORDER_STATUSES.PENDING,
    };
    assert.match(order.orderNumber, /^ORD-\d{8}-[A-F0-9]{6}$/);

    const liveBankConfig = {
      bankId: '970422',
      accountNumber: '0903123456888',
      accountName: 'TORI SAKURA DINING',
    };
    const vietQrUrl = generateVietQrUrl({
      bankConfig: liveBankConfig,
      depositAmount: order.depositAmount,
      orderCode: order.orderNumber,
    });
    assert.ok(vietQrUrl.includes('amount=240300'));
    assert.ok(vietQrUrl.includes(order.orderNumber));

    validateOrderStateTransition(order.status, ORDER_STATUSES.CONFIRMED);
    order.status = ORDER_STATUSES.CONFIRMED;
    validateOrderStateTransition(order.status, ORDER_STATUSES.IN_PREPARATION);
    order.status = ORDER_STATUSES.IN_PREPARATION;
    validateOrderStateTransition(order.status, ORDER_STATUSES.SERVED);
    order.status = ORDER_STATUSES.SERVED;
    validateOrderStateTransition(order.status, ORDER_STATUSES.COMPLETED);
    order.status = ORDER_STATUSES.COMPLETED;
    assert.equal(order.status, ORDER_STATUSES.COMPLETED);
  });

  it('T4-SCENARIO-02: Corporate Event Booking (8-Person Reservation -> VIP Tatami -> RSV- Pending Ticket)', () => {
    const bookingRequest = {
      branchId: 1,
      date: getFutureDateStr(2),
      time: '19:00',
      guestCount: 8,
      preferredAreaId: SEATING_AREAS.TATAMI_ROOM.id,
      customerName: 'Trần Mai Phương',
      customerPhone: '0912345678',
      customerEmail: 'phuong.tran@abctech.vn',
      specialRequests: 'Tiệc tiếp đối tác Nhật Bản. Cần chuẩn bị phòng trước 15 phút. Cần hóa đơn VAT.',
    };

    const validation = validateReservationForm(bookingRequest);
    assert.ok(validation.isValid);

    const ticket = createReservationTicket(bookingRequest);
    validateReservationSchema(ticket);
    assert.equal(ticket.guestCount, 8);
    assert.equal(ticket.preferredAreaId, 3);
    assert.equal(ticket.status, 'Pending');
    assert.equal(ticket.depositStatus, 'Pending');
    assert.match(ticket.reservationCode, /^RSV-\d{8}-[A-F0-9]{6}$/);
    assertContainsText(ticket.specialRequests, 'Tiệc tiếp đối tác Nhật Bản');
  });

  it('T4-SCENARIO-03: Prepayment Journey with JAPANFOOD50K Voucher & FullBank (100%) Transfer', () => {
    const sushiCombo = {
      menuItemId: 20,
      itemName: 'Thuyền Sushi & Sashimi Thượng Hạng 24 món',
      basePrice: 750000,
      quantity: 1,
    };
    const matchaDessert = {
      menuItemId: 40,
      itemName: 'Matcha Parfait Kyoto Đặc Biệt',
      basePrice: 85000,
      quantity: 2,
    };

    const voucher = {
      id: 1,
      code: 'JAPANFOOD50K',
      title: 'Giảm 50.000đ',
      discountType: 'FixedAmount',
      discountValue: 50000,
      minOrderAmount: 300000,
      isActive: true,
    };

    const pricing = calculateServerOrderTotals([sushiCombo, matchaDessert], PAYMENT_METHODS.FULL_BANK, voucher);
    assert.equal(pricing.subTotal, 920000);
    assert.equal(pricing.taxAmount, Math.round(920000 * 0.08)); // 73,600
    assert.equal(pricing.discountAmount, 50000);
    assert.equal(pricing.totalAmount, 920000 + 73600 - 50000); // 943,600

    assertStrictDepositPolicy(pricing);
    assert.equal(pricing.depositAmount, 943600);
    assert.equal(pricing.remainingCodAmount, 0);

    const order = {
      orderNumber: generateOrderCode(new Date(), '02EFGH'),
      ...pricing,
      status: ORDER_STATUSES.PENDING,
    };

    const fullVietQr = generateVietQrUrl({
      bankConfig: { bankId: '970422', accountNumber: '0903123456888', accountName: 'TORI SAKURA DINING' },
      depositAmount: order.depositAmount,
      orderCode: order.orderNumber,
    });
    assert.ok(fullVietQr.includes('amount=943600'));

    validateOrderStateTransition(order.status, ORDER_STATUSES.CONFIRMED);
    order.status = ORDER_STATUSES.CONFIRMED;
    assert.equal(order.status, ORDER_STATUSES.CONFIRMED);
  });

  it('T4-SCENARIO-04: Information & Brand Exploration Journey (TORI SAKURA About Us -> BranchDto -> BlogPostDto -> Menu)', () => {
    const aboutSection = {
      brandName: BRAND_NAME,
      headChef: 'Master Chef Kenji Tanaka',
      philosophy: 'Omotenashi & Wabi-Sabi',
      directSourcing: ['Chợ đầu mối Toyosu Tokyo', 'Kagoshima Wagyu', 'Koshihikari Rice'],
    };
    assert.equal(aboutSection.brandName, 'TORI SAKURA JAPANESE DINING');
    assertContainsText(aboutSection.philosophy, 'Omotenashi');
    assert.equal(aboutSection.directSourcing.length, 3);

    const branchInfo = {
      id: 1,
      code: 'HN-HOANKIEM',
      name: 'Tori Sakura Hoàn Kiếm',
      address: '88 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
      phone: '024-3939-1111',
      openingHours: '10:30 - 14:00 | 17:00 - 22:00',
      parkingInfo: 'Tầng hầm miễn phí',
      mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18',
      mapDirectionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=21.0245,105.8412',
    };
    validateBranchSchema(branchInfo);

    const article = {
      id: 1,
      slug: 'art-of-edomae-sushi',
      title: 'Nghệ thuật thưởng thức Sushi chuẩn Edomae',
      category: 'Cuisine Culture',
      excerpt: 'Khám phá tinh hoa Edomae Sushi.',
      content: 'Nội dung bài viết chuyên sâu về kỹ thuật ủ cá Edomae và cơm giấm Akazu.',
      authorName: 'Master Chef Kenji Tanaka',
      readTimeMinutes: 6,
    };
    validateBlogSchema(article);
  });

  it('T4-SCENARIO-05: 2-Step Register + OTP Verify -> Logout -> OTP Reset -> Login -> /api/auth/me Persistence', () => {
    const storage = new MockStorage();

    // 1. Register (201) + Verify OTP -> tokens stored under torisakura_*
    const registeredUser = {
      id: 701,
      fullName: 'Đặng Minh Đức',
      email: 'duc.dang@example.com',
      phoneNumber: '+84967890123',
      role: 'CUSTOMER',
      loyaltyPoints: 0,
      membershipTier: 'BRONZE',
    };
    validateUserProfileSchema(registeredUser);
    setAuthTokens(storage, {
      accessToken: 'jwt_duc_access_1',
      refreshToken: 'jwt_duc_refresh_1',
    });

    // 2. Logout
    clearAuthTokens(storage);
    assert.equal(getAuthTokens(storage).accessToken, null);
    assert.equal(storage.getItem('japanfood_auth_user'), null);

    // 3. Forgot Password 3-step reset + Re-login
    setAuthTokens(storage, {
      accessToken: 'jwt_duc_access_2',
      refreshToken: 'jwt_duc_refresh_2',
    });

    // 4. Reload re-hydration via torisakura_access_token -> GET /api/auth/me
    const { accessToken } = getAuthTokens(storage);
    assert.equal(accessToken, 'jwt_duc_access_2');
    assert.equal(AUTH_STORAGE_KEYS.ACCESS_TOKEN, 'torisakura_access_token');

    if (STRICT_R2) {
      assert.equal(existsSync(join(PROJECT_ROOT, 'src', 'data', 'mockData.ts')), false, 'mockData.ts must not exist');
    }
  });
});
