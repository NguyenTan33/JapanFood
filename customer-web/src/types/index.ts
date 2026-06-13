// ============================================================================
// JAPANESE RESTAURANT CUSTOMER WEB - TYPESCRIPT DTO & CONTRACT INTERFACES
// Aligned with ASP.NET Core 9 Web API DTOs (DOCS_API_CONTROLLER_HANDOVER.md)
// ============================================================================

// --- 1. MENU & DISHES ---

export interface DishOption {
  id: number;
  code: string;
  name: string;
  priceAdjustment: number; // in VND (e.g. 15000)
  isDefault?: boolean;
  isAvailable?: boolean;
}

export interface DishOptionGroup {
  id: number;
  code: string;
  name: string;
  isRequired: boolean;
  minSelection: number;
  maxSelection: number;
  options: DishOption[];
}

export interface Dish {
  id: number;
  code: string;
  name: string;
  japaneseName: string;
  slug: string;
  categoryId: string;
  categoryDbId?: number;
  categoryName: string;
  price: number; // Base price in VND
  originalPrice?: number; // Pre-discount price if on sale
  description: string;
  imageUrl: string;
  tags: string[]; // e.g. ['Best Seller', 'Chef Choice', 'Signature', 'Spicy']
  rating: number; // Average rating (e.g. 4.9)
  reviewCount: number;
  ingredients: string[];
  spiceLevel?: number; // 0 = None, 1 = Mild, 2 = Medium, 3 = Hot
  calories?: number;
  preparationTimeMinutes: number;
  kitchenStation?: string;
  isAvailable: boolean;
  isFeatured: boolean;
  optionGroups?: DishOptionGroup[];
}

export interface Category {
  id: string; // 'ramen' | 'sushi-sashimi' | 'tempura-fried' | 'wagyu-grilled' | 'donburi-rice' | 'drinks-sake' | 'desserts'
  dbId?: number;
  code: string;
  name: string;
  japaneseName: string;
  description?: string;
  iconName: string; // Lucide icon identifier (e.g. 'Soup', 'Fish', 'Flame')
  displayOrder: number;
  dishCount: number;
  imageUrl?: string;
  isActive?: boolean;
}

export interface DishFilterQuery {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  isFeatured?: boolean;
  tag?: string;
  keyword?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'rating_desc' | 'popular';
}

// --- 2. CART & CHECKOUT (STRICT DEPOSIT ENFORCEMENT) ---

export interface CartItemOption {
  optionId: number;
  optionName: string;
  priceAdjustment: number;
  groupName?: string;
}

export interface CartItem {
  id: string; // Composite unique key: `${dishId}-${optionIds.sort().join('_')}`
  dishId: number;
  code: string;
  name: string;
  japaneseName?: string;
  imageUrl: string;
  basePrice: number;
  selectedOptions: CartItemOption[];
  modifiersPrice: number;
  totalUnitPrice: number; // basePrice + modifiersPrice
  quantity: number;
  specialInstructions?: string;
}

export type PaymentMethod = 'FULL_BANK_TRANSFER' | 'COD_WITH_50_DEPOSIT';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_DEPOSIT'
  | 'PAID'
  | 'DEPOSIT_CONFIRMED'
  | 'COOKING'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderCustomerInfo {
  name: string;
  phone: string;
  email?: string;
  address: string;
  district?: string;
  city?: string;
  note?: string;
}

export interface BankAccountInfo {
  bankName: string;
  bankCode: string; // e.g. 'MB', 'VCB', 'ACB'
  accountNumber: string;
  accountHolder: string;
  branch: string;
  defaultQrTemplate?: string;
}

export interface Order {
  id: string;
  orderCode: string; // Format: ORD-YYYYMMDD-XXXXXX
  customer: OrderCustomerInfo;
  items: CartItem[];
  subtotal: number;
  vatAmount: number; // 8% standard F&B VAT
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number; // subtotal + vatAmount + deliveryFee - discountAmount
  paymentMethod: PaymentMethod;
  depositRate: 1.0 | 0.5;
  depositAmount: number; // Amount required to transfer immediately
  remainingCodAmount: number; // Amount to pay in cash upon delivery
  status: OrderStatus;
  voucherCode?: string;
  createdAt: string;
  paidAt?: string;
  vietQrUrl?: string;
}

// --- 3. TABLE RESERVATION ---

export type ReservationAreaId = 'sushi-bar' | 'tatami-room' | 'main-dining' | 'vip-room';

export interface TableArea {
  id: ReservationAreaId;
  dbId?: number;
  code: string;
  name: string;
  japaneseName: string;
  description: string;
  imageUrl: string;
  features: string[];
  capacityPerTable: string;
  capacityDescription?: string;
  extraFeePercent?: number;
  minGuests: number;
  maxGuests: number;
  requiresDeposit: boolean;
  depositPerGuest?: number; // e.g. 100,000 VND/guest for VIP
}

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type DepositStatus = 'NONE' | 'PENDING' | 'PAID' | 'REFUNDED';

export interface Reservation {
  id: string;
  reservationCode: string; // Format: RSV-YYYYMMDD-XXXXXX
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  guestCount: number; // 1 to 20 guests
  reservationDate: string; // YYYY-MM-DD
  reservationTime: string; // HH:mm (Lunch: 10:30-14:00, Dinner: 17:00-22:00)
  areaId: ReservationAreaId;
  areaName: string;
  specialRequests?: string;
  allergies?: string;
  status: ReservationStatus;
  depositAmount: number;
  depositStatus: DepositStatus;
  assignedTableNumber?: string;
  createdAt: string;
}

// --- 4. BLOG & CULTURAL STORIES ---

export type BlogCategory =
  | 'Cuisine Culture'
  | 'Ingredients & Sourcing'
  | 'Culinary Art'
  | 'Chef Journal';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  japaneseTitle: string;
  category: BlogCategory;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  coverImage: string;
  publishedAt: string;
  readTimeMinutes: number;
  summary: string;
  content: string; // Markdown or rich HTML
  tags: string[];
  relatedDishIds: number[];
}

// --- 5. BRANCH LOCATIONS ---

export interface BranchLocation {
  id: string;
  name: string;
  japaneseName: string;
  address: string;
  district: string;
  city: string;
  phone: string;
  hotline: string;
  email: string;
  openingHours: {
    lunch: string;
    dinner: string;
    note?: string;
  };
  parkingInfo: {
    motorbike: string;
    car: string;
  };
  googleMapsUrl: string;
  googleMapsEmbedUrl: string;
  imageUrl: string;
  isFlagship?: boolean;
}

// --- 6. REVIEWS & RATINGS ---

export interface Review {
  id: number;
  userName: string;
  userAvatar: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  dishId?: number;
  dishName?: string;
  isVerifiedDining: boolean;
  likesCount?: number;
}

// --- 7. VOUCHERS & PROMOTIONS ---

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface Voucher {
  id: number;
  code: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number; // Percentage (e.g. 10) or VND amount (e.g. 50000)
  minOrderAmount: number;
  maxDiscountAmount?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

// --- 8. USER & AUTHENTICATION ---

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'CUSTOMER';
export type MembershipTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export function normalizeUserRole(role?: string | null): UserRole {
  const upper = (role || '').trim().toUpperCase();
  if (upper === 'ADMIN' || upper === 'MANAGER' || upper === 'STAFF' || upper === 'KITCHEN') {
    return upper;
  }
  return 'CUSTOMER';
}

export function isStaffRole(role?: string | null): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'STAFF';
}

export function isKitchenRole(role?: string | null): boolean {
  return normalizeUserRole(role) === 'KITCHEN';
}

export function isInternalRole(role?: string | null): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'STAFF' || normalized === 'KITCHEN';
}

export interface User {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  avatarUrl?: string;
  role: UserRole;
  membershipTier: MembershipTier;
  loyaltyPoints: number;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
