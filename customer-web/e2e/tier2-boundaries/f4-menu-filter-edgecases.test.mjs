import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterDishes, validateDishSchema, simulateAuthGatedCartAction } from '../harness/index.mjs';

const DISH_CATALOG_DTOS = [
  {
    dishId: 1,
    code: 'WAGYU-01',
    name: 'Bò Wagyu Kagoshima Nướng Than Hoa',
    japaneseName: '鹿児島県産黒毛和牛炭火焼き',
    basePrice: 680000,
    categoryId: 4,
    categoryCode: 'wagyu-grilled',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947',
    isAvailable: true,
    isFeatured: true,
    tags: ['Premium', 'Chef Choice'],
  },
  {
    dishId: 2,
    code: 'RAMEN-03',
    name: 'Shoyu Ramen Truyền Thống',
    japaneseName: '伝統醤油ラーメン',
    basePrice: 145000,
    categoryId: 1,
    categoryCode: 'ramen',
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624',
    isAvailable: true,
    isFeatured: false,
    tags: ['Popular'],
  },
  {
    dishId: 3,
    code: 'SASHIMI-99',
    name: 'Sashimi Bào Ngư Sống Theo Mùa',
    japaneseName: '活鮑の刺身',
    basePrice: 890000,
    categoryId: 2,
    categoryCode: 'sushi-sashimi',
    imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c',
    isAvailable: false,
    isFeatured: false,
    tags: ['Seasonal'],
  },
];

describe('Tier 2 - Boundary R4: Menu Filter & Search Edge Cases', () => {
  it('T2-R4-01: Search with zero matching results returning empty array state', () => {
    for (const dish of DISH_CATALOG_DTOS) {
      validateDishSchema(dish);
    }
    const results = filterDishes(DISH_CATALOG_DTOS, { searchQuery: 'mon_an_khong_ton_tai_xyz' });
    assert.equal(results.length, 0);
  });

  it('T2-R4-02: Search diacritic accent and case insensitivity normalization', () => {
    const accentedLower = filterDishes(DISH_CATALOG_DTOS, { searchQuery: 'bò wagyu' });
    const accentedUpper = filterDishes(DISH_CATALOG_DTOS, { searchQuery: 'BÒ WAGYU' });
    const unaccented = filterDishes(DISH_CATALOG_DTOS, { searchQuery: 'bo wagyu' });

    assert.equal(accentedLower.length, 1);
    assert.equal(accentedUpper.length, 1);
    assert.equal(unaccented.length, 1);
    assert.equal(accentedLower[0].dishId, accentedUpper[0].dishId);
    assert.equal(accentedLower[0].dishId, unaccented[0].dishId);
  });

  it('T2-R4-03: Price range boundary values (inclusive exact basePrice bounds)', () => {
    const exactMatch = filterDishes(DISH_CATALOG_DTOS, { minPrice: 145000, maxPrice: 145000 });
    assert.equal(exactMatch.length, 1);
    assert.equal(exactMatch[0].basePrice, 145000);

    const rangeExcluded = filterDishes(DISH_CATALOG_DTOS, { minPrice: 150000, maxPrice: 500000 });
    assert.equal(rangeExcluded.length, 0);
  });

  it('T2-R4-04: Price range inverted bounds auto-clamping logic', () => {
    function sanitizePriceFilter(rawMin, rawMax) {
      let min = Math.max(0, Number(rawMin) || 0);
      let max = Math.max(0, Number(rawMax) || Infinity);
      if (min > max) {
        const temp = min;
        min = max;
        max = temp;
      }
      return { min, max };
    }

    const clamped = sanitizePriceFilter(500000, 200000);
    assert.equal(clamped.min, 200000);
    assert.equal(clamped.max, 500000);

    const negativeHandled = sanitizePriceFilter(-50000, 300000);
    assert.equal(negativeHandled.min, 0);
    assert.equal(negativeHandled.max, 300000);
  });

  it('T2-R4-05: Mandatory DishModifierGroupDto selection enforcement', () => {
    const modifierGroup = {
      groupId: 1,
      groupCode: 'BROTH_SALT',
      groupName: 'Chọn độ mặn của nước dùng',
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      options: [
        { optionId: 11, optionCode: 'LIGHT', optionName: 'Nhạt (Light)', priceAdjustment: 0, isDefault: false, isAvailable: true },
        { optionId: 12, optionCode: 'NORMAL', optionName: 'Vừa (Normal)', priceAdjustment: 0, isDefault: true, isAvailable: true },
        { optionId: 13, optionCode: 'RICH', optionName: 'Đậm đà (Rich)', priceAdjustment: 10000, isDefault: false, isAvailable: true },
      ],
    };

    function validateModifierSelection(group, selectedOptionIds) {
      if (group.isRequired && (!selectedOptionIds || selectedOptionIds.length < group.minSelection)) {
        throw new Error(`Vui lòng chọn "${group.groupName}" trước khi thêm vào giỏ`);
      }
      if (selectedOptionIds.length > group.maxSelection) {
        throw new Error(`Chỉ được chọn tối đa ${group.maxSelection} tùy chọn cho "${group.groupName}"`);
      }
      return true;
    }

    assert.throws(
      () => validateModifierSelection(modifierGroup, []),
      /Vui lòng chọn "Chọn độ mặn của nước dùng"/
    );
    assert.throws(
      () => validateModifierSelection(modifierGroup, [11, 12]),
      /tối đa 1/
    );

    assert.equal(validateModifierSelection(modifierGroup, [12]), true);
  });

  it('T2-R4-06: Out of stock / unavailable dish action prevention (even when authenticated)', () => {
    const unavailableDish = DISH_CATALOG_DTOS.find((d) => !d.isAvailable);
    assert.ok(unavailableDish);

    const action = simulateAuthGatedCartAction({ isAuthenticated: true, dish: unavailableDish });
    assert.equal(action.allowed, false);
    assert.equal(action.statusCode, 400);
    assert.ok(action.reason.includes('tạm hết'));
  });
});
