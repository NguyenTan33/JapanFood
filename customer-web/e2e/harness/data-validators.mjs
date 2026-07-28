import assert from 'node:assert/strict';

export function validateModifierOptionSchema(option) {
  assert.ok(option && typeof option === 'object', 'ModifierOption must be an object');
  assert.ok(Number.isInteger(option.optionId) && option.optionId > 0, 'ModifierOption must have positive integer optionId');
  assert.ok(typeof option.optionCode === 'string' && option.optionCode.length > 0, 'ModifierOption must have optionCode');
  assert.ok(typeof option.optionName === 'string' && option.optionName.length > 0, 'ModifierOption must have optionName');
  assert.ok(typeof option.priceAdjustment === 'number', 'ModifierOption priceAdjustment must be number');
  assert.ok(typeof option.isDefault === 'boolean', 'ModifierOption isDefault must be boolean');
  assert.ok(typeof option.isAvailable === 'boolean', 'ModifierOption isAvailable must be boolean');
}

export function validateModifierGroupSchema(group) {
  assert.ok(group && typeof group === 'object', 'ModifierGroup must be an object');
  assert.ok(Number.isInteger(group.groupId) && group.groupId > 0, 'ModifierGroup must have positive integer groupId');
  assert.ok(typeof group.groupCode === 'string' && group.groupCode.length > 0, 'ModifierGroup must have groupCode');
  assert.ok(typeof group.groupName === 'string' && group.groupName.length > 0, 'ModifierGroup must have groupName');
  assert.ok(typeof group.isRequired === 'boolean', 'ModifierGroup isRequired must be boolean');
  assert.ok(Number.isInteger(group.minSelection) && group.minSelection >= 0, 'ModifierGroup minSelection must be non-negative integer');
  assert.ok(Number.isInteger(group.maxSelection) && group.maxSelection >= group.minSelection, 'ModifierGroup maxSelection must be >= minSelection');
  assert.ok(Array.isArray(group.options), 'ModifierGroup options must be an array');
  for (const opt of group.options) {
    validateModifierOptionSchema(opt);
  }
}

export function validateDishSchema(dish, { requireDetail = false } = {}) {
  assert.ok(dish && typeof dish === 'object', 'Dish must be defined');
  assert.ok(Number.isInteger(dish.dishId) && dish.dishId > 0, 'Dish must have positive integer dishId');
  assert.ok(typeof dish.code === 'string' && dish.code.length > 0, 'Dish must have a code');
  assert.ok(typeof dish.name === 'string' && dish.name.length > 0, 'Dish must have a name');
  assert.ok(typeof dish.japaneseName === 'string', 'Dish must have a japaneseName');
  assert.ok(typeof dish.basePrice === 'number' && dish.basePrice > 0, 'Dish basePrice must be positive number');
  if (dish.originalPrice !== undefined && dish.originalPrice !== null) {
    assert.ok(typeof dish.originalPrice === 'number' && dish.originalPrice >= dish.basePrice, 'Dish originalPrice must be >= basePrice');
  }
  assert.ok(typeof dish.imageUrl === 'string' && dish.imageUrl.length > 0, 'Dish must have imageUrl');
  assert.ok(typeof dish.isAvailable === 'boolean', 'Dish isAvailable must be boolean');
  assert.ok(typeof dish.isFeatured === 'boolean', 'Dish isFeatured must be boolean');

  if (dish.tags !== undefined) {
    assert.ok(Array.isArray(dish.tags), 'Dish tags must be an array');
  }
  if (requireDetail || dish.ingredients !== undefined) {
    assert.ok(Array.isArray(dish.ingredients), 'Dish ingredients must be an array');
  }
  if (requireDetail || dish.modifierGroups !== undefined) {
    assert.ok(Array.isArray(dish.modifierGroups), 'Dish modifierGroups must be an array');
    for (const mg of dish.modifierGroups) {
      validateModifierGroupSchema(mg);
    }
  }
}

export function validateCategorySchema(category) {
  assert.ok(category && typeof category === 'object', 'Category must be defined');
  assert.ok(Number.isInteger(category.categoryId) && category.categoryId > 0, 'Category must have positive integer categoryId');
  assert.ok(typeof category.categoryCode === 'string' && category.categoryCode.length > 0, 'Category must have categoryCode');
  assert.ok(typeof category.categoryName === 'string' && category.categoryName.length > 0, 'Category must have categoryName');
  assert.ok(typeof category.japaneseName === 'string', 'Category must have japaneseName');
  assert.ok(typeof category.displayOrder === 'number', 'Category displayOrder must be number');
  assert.ok(Array.isArray(category.dishes), 'CategoryMenuDto must include dishes array');
  for (const dish of category.dishes) {
    validateDishSchema(dish);
  }
}

export function validateLocationSchema(branch) {
  assert.ok(branch && typeof branch === 'object', 'Branch must be defined');
  assert.ok(branch.id !== undefined && branch.id !== null, 'Branch must have id');
  assert.ok(typeof branch.code === 'string' && branch.code.length > 0, 'Branch must have code');
  assert.ok(typeof branch.name === 'string' && branch.name.length > 0, 'Branch must have name');
  assert.ok(typeof branch.address === 'string' && branch.address.length > 0, 'Branch must have address');
  assert.ok(typeof branch.phone === 'string' && branch.phone.length > 0, 'Branch must have phone');
  assert.ok(branch.openingHours !== undefined && branch.openingHours !== null, 'Branch must have openingHours');
  assert.ok(branch.parkingInfo !== undefined && branch.parkingInfo !== null, 'Branch must have parkingInfo');
  assert.ok(typeof branch.mapEmbedUrl === 'string' && branch.mapEmbedUrl.length > 0, 'Branch must have mapEmbedUrl');
  assert.match(
    branch.mapEmbedUrl,
    /^https:\/\/(www\.)?google\.com\/maps/i,
    'Branch mapEmbedUrl must be a valid HTTPS Google Maps URL'
  );
  assert.ok(typeof branch.mapDirectionsUrl === 'string' && branch.mapDirectionsUrl.length > 0, 'Branch must have mapDirectionsUrl');
  assert.match(
    branch.mapDirectionsUrl,
    /^https:\/\/(www\.)?(google\.com\/maps|maps\.google\.com|goo\.gl\/maps)/i,
    'Branch mapDirectionsUrl must be a valid HTTPS Google Maps directions URL'
  );
}

export const validateBranchSchema = validateLocationSchema;

export function validateBlogSchema(blog) {
  assert.ok(blog && typeof blog === 'object', 'Blog must be defined');
  assert.ok(blog.id !== undefined && blog.id !== null, 'Blog must have id');
  assert.ok(typeof blog.slug === 'string' && blog.slug.length > 0, 'Blog must have slug');
  assert.ok(typeof blog.title === 'string' && blog.title.length > 0, 'Blog must have title');
  assert.ok(typeof blog.category === 'string' && blog.category.length > 0, 'Blog must have category');
  assert.ok(typeof blog.excerpt === 'string' && blog.excerpt.length > 0, 'Blog must have excerpt');
  assert.ok(typeof blog.content === 'string' && blog.content.length > 0, 'Blog must have content');
  assert.ok(typeof blog.authorName === 'string' && blog.authorName.length > 0, 'Blog must have flat authorName');
  assert.ok(typeof blog.readTimeMinutes === 'number' && blog.readTimeMinutes > 0, 'Blog readTimeMinutes must be positive number');
}

export const validateBlogPostSchema = validateBlogSchema;

export function validateVoucherSchema(voucher) {
  assert.ok(voucher && typeof voucher === 'object', 'Voucher must be defined');
  assert.ok(typeof voucher.code === 'string' && voucher.code.length > 0, 'Voucher must have code');
  assert.ok(typeof voucher.title === 'string' && voucher.title.length > 0, 'Voucher must have title');
  assert.ok(typeof voucher.discountValue === 'number' && voucher.discountValue > 0, 'Voucher discountValue must be positive');
  const normalizedType = String(voucher.discountType || '').toLowerCase();
  assert.ok(
    ['percentage', 'fixedamount', 'fixed_amount'].includes(normalizedType),
    `Invalid discountType: ${voucher.discountType} (expected Percentage or FixedAmount)`
  );
  assert.ok(typeof voucher.minOrderAmount === 'number' && voucher.minOrderAmount >= 0, 'Voucher minOrderAmount must be >= 0');
  assert.ok(voucher.endDate && !Number.isNaN(new Date(voucher.endDate).getTime()), 'Voucher must have valid endDate');
}

export function validateReservationSchema(res) {
  assert.ok(res && typeof res === 'object', 'Reservation must be defined');
  assert.match(
    String(res.reservationCode || ''),
    /^RSV-\d{8}-[A-F0-9]{6}$/,
    `Reservation reservationCode "${res.reservationCode}" must match RSV-yyyyMMdd-XXXXXX`
  );
  assert.ok(
    ['Pending', 'Confirmed', 'Seated', 'Completed', 'Cancelled', 'NoShow'].includes(res.status),
    `Invalid Reservation status: ${res.status}`
  );
  if (res.depositStatus !== undefined && res.depositStatus !== null) {
    assert.ok(typeof res.depositStatus === 'string' && res.depositStatus.length > 0, 'depositStatus must be non-empty string');
  }
  assert.ok(typeof res.guestCount === 'number' && res.guestCount >= 1 && res.guestCount <= 20, 'guestCount must be 1-20');
  assert.ok(res.reservationTime && !Number.isNaN(new Date(res.reservationTime).getTime()), 'Reservation must have valid ISO reservationTime');
  assert.ok(typeof res.customerName === 'string' && res.customerName.length > 0, 'Reservation must have customerName');
  assert.ok(typeof res.customerPhone === 'string' && res.customerPhone.length > 0, 'Reservation must have customerPhone');
}

export function validateCartViewSchema(cart) {
  assert.ok(cart && typeof cart === 'object', 'CartViewDto must be defined');
  assert.ok(Array.isArray(cart.items), 'CartViewDto.items must be an array');
  assert.ok(typeof cart.subTotal === 'number' && cart.subTotal >= 0, 'CartViewDto.subTotal must be >= 0');
  assert.ok(Number.isInteger(cart.totalItemCount) && cart.totalItemCount >= 0, 'CartViewDto.totalItemCount must be >= 0');
  for (const item of cart.items) {
    assert.ok(Number.isInteger(item.cartItemId) && item.cartItemId > 0, 'CartItemDto must have cartItemId');
    assert.ok(Number.isInteger(item.menuItemId) && item.menuItemId > 0, 'CartItemDto must have menuItemId');
    assert.ok(typeof item.dishCode === 'string' && item.dishCode.length > 0, 'CartItemDto must have dishCode');
    assert.ok(typeof item.itemName === 'string' && item.itemName.length > 0, 'CartItemDto must have itemName');
    assert.ok(typeof item.imageUrl === 'string' && item.imageUrl.length > 0, 'CartItemDto must have imageUrl');
    assert.ok(typeof item.basePrice === 'number' && item.basePrice > 0, 'CartItemDto basePrice must be > 0');
    assert.ok(Number.isInteger(item.quantity) && item.quantity >= 1, 'CartItemDto quantity must be >= 1');
    assert.ok(Array.isArray(item.modifiers), 'CartItemDto modifiers must be an array');
    assert.ok(typeof item.itemTotalPrice === 'number' && item.itemTotalPrice > 0, 'CartItemDto itemTotalPrice must be > 0');
  }
}

export function validateUserProfileSchema(user) {
  assert.ok(user && typeof user === 'object', 'UserProfileDto must be defined');
  assert.ok(user.id !== undefined && user.id !== null, 'UserProfileDto must have id');
  assert.ok(typeof user.fullName === 'string' && user.fullName.length > 0, 'UserProfileDto must have fullName');
  assert.ok(typeof user.email === 'string' && user.email.includes('@'), 'UserProfileDto must have valid email');
  assert.ok(typeof user.role === 'string' && user.role.length > 0, 'UserProfileDto must have role');
  assert.equal(user.passwordHash, undefined, 'UserProfileDto must never expose passwordHash');
}

export function validateRestaurantInfoSchema(info) {
  assert.ok(info && typeof info === 'object', 'RestaurantInfoDto must be defined');
  assert.ok(typeof info.brandName === 'string' && info.brandName.length > 0, 'RestaurantInfoDto must have brandName');
  assert.ok(typeof info.hotline === 'string' && info.hotline.length > 0, 'RestaurantInfoDto must have hotline');
  assert.ok(typeof info.email === 'string' && info.email.includes('@'), 'RestaurantInfoDto must have valid email');
  assert.ok(typeof info.bankName === 'string' && info.bankName.length > 0, 'RestaurantInfoDto must have bankName');
  assert.ok(typeof info.bankId === 'string' && info.bankId.length > 0, 'RestaurantInfoDto must have bankId');
  assert.ok(typeof info.accountNumber === 'string' && info.accountNumber.length > 0, 'RestaurantInfoDto must have accountNumber');
  assert.ok(typeof info.accountName === 'string' && info.accountName.length > 0, 'RestaurantInfoDto must have accountName');
}
