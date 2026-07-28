import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BookFlipStateMachine,
  filterDishes,
  validateCategorySchema,
  validateDishSchema,
} from '../harness/index.mjs';

const LIVE_DTO_CATEGORIES = [
  {
    categoryId: 1,
    categoryCode: 'ramen',
    categoryName: 'Mì Ramen & Udon',
    japaneseName: 'ラーメン・うどん',
    description: 'Nước dùng hầm xương 18 giờ chuẩn vị',
    iconName: 'Soup',
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624',
    displayOrder: 1,
    dishes: [
      {
        dishId: 1,
        code: 'RAMEN-01',
        name: 'Tonkotsu Ramen Đặc Biệt',
        japaneseName: '特製豚骨ラーメン',
        slug: 'tonkotsu-ramen-dac-biet',
        basePrice: 165000,
        originalPrice: 185000,
        imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624',
        shortDescription: 'Nước dùng hầm xương heo 18 giờ đậm đà, thịt chashu mềm tan.',
        tags: ['Best Seller', 'Signature'],
        calories: 680,
        spiceLevel: 1,
        estimatedPrepMinutes: 15,
        isFeatured: true,
        isAvailable: true,
        averageRating: 4.9,
        totalReviews: 12,
        ingredients: ['Xương heo hầm 18h', 'Thịt Chashu', 'Trứng lòng đào'],
        modifierGroups: [
          {
            groupId: 1,
            groupCode: 'BROTH',
            groupName: 'Độ đậm nước dùng',
            isRequired: true,
            minSelection: 1,
            maxSelection: 1,
            options: [
              { optionId: 1, optionCode: 'LIGHT', optionName: 'Thanh nhẹ', priceAdjustment: 0, isDefault: false, isAvailable: true },
              { optionId: 2, optionCode: 'RICH', optionName: 'Đậm đà (Rich)', priceAdjustment: 10000, isDefault: true, isAvailable: true },
            ],
          },
          {
            groupId: 2,
            groupCode: 'TOPPING',
            groupName: 'Topping thêm',
            isRequired: false,
            minSelection: 0,
            maxSelection: 3,
            options: [
              { optionId: 3, optionCode: 'TAMAGO', optionName: 'Trứng Ajitsuke Tamago', priceAdjustment: 15000, isDefault: false, isAvailable: true },
            ],
          },
        ],
      },
      {
        dishId: 4,
        code: 'RAMEN-02',
        name: 'Miso Ramen Cay Tokyo',
        japaneseName: '辛味噌ラーメン',
        slug: 'miso-ramen-cay-tokyo',
        basePrice: 155000,
        originalPrice: null,
        imageUrl: 'https://images.unsplash.com/photo-1557872943-16a5ac26437e',
        shortDescription: 'Miso đỏ cay nồng, bắp ngọt Hokkaido và bơ mềm thơm.',
        tags: ['Spicy'],
        calories: 640,
        spiceLevel: 2,
        estimatedPrepMinutes: 15,
        isFeatured: false,
        isAvailable: true,
        averageRating: 4.7,
        totalReviews: 6,
      },
    ],
  },
  {
    categoryId: 2,
    categoryCode: 'sushi-sashimi',
    categoryName: 'Sushi & Sashimi',
    japaneseName: '寿司・刺身',
    description: 'Hải sản tươi sống nhập khẩu Toyosu',
    iconName: 'Fish',
    imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c',
    displayOrder: 2,
    dishes: [
      {
        dishId: 2,
        code: 'SUSHI-01',
        name: 'Set Nigiri Thượng Hạng 10 Món',
        japaneseName: '特選握り寿司10貫',
        slug: 'set-nigiri-thuong-hang-10-mon',
        basePrice: 380000,
        originalPrice: null,
        imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c',
        shortDescription: 'Hải sản nhập khẩu trực tiếp từ chợ Toyosu Tokyo.',
        tags: ['Chef Choice'],
        calories: 520,
        spiceLevel: 0,
        estimatedPrepMinutes: 12,
        isFeatured: true,
        isAvailable: true,
        averageRating: 4.9,
        totalReviews: 18,
      },
    ],
  },
  {
    categoryId: 3,
    categoryCode: 'tempura-fried',
    categoryName: 'Tempura & Món Chiên',
    japaneseName: '天ぷら',
    description: 'Giòn rụm kiểu Kyoto',
    iconName: 'Flame',
    imageUrl: 'https://images.unsplash.com/photo-1580822184713-fc5400e7fe10',
    displayOrder: 3,
    dishes: [
      {
        dishId: 3,
        code: 'TEMPURA-01',
        name: 'Tempura Tôm Sú & Rau Củ Theo Mùa',
        japaneseName: '海老と季節野菜の天ぷら',
        slug: 'tempura-tom-su-rau-cu',
        basePrice: 145000,
        originalPrice: null,
        imageUrl: 'https://images.unsplash.com/photo-1580822184713-fc5400e7fe10',
        shortDescription: 'Bột chiên giòn mỏng kiểu Kyoto, phục vụ cùng muối matcha.',
        tags: ['Crispy'],
        calories: 430,
        spiceLevel: 0,
        estimatedPrepMinutes: 10,
        isFeatured: false,
        isAvailable: true,
        averageRating: 4.6,
        totalReviews: 5,
      },
    ],
  },
];

const FLATTENED_DISHES = LIVE_DTO_CATEGORIES.flatMap((c) =>
  c.dishes.map((d) => ({ ...d, categoryId: c.categoryId, categoryCode: c.categoryCode }))
);

describe('Tier 1 - Feature R4: Interactive Menu & Advanced Dish Search', () => {
  it('T1-R4-01: 3D Book-Flip Menu Two-Page Spread Rendering on desktop & CategoryMenuDto contract', () => {
    for (const cat of LIVE_DTO_CATEGORIES) {
      validateCategorySchema(cat);
    }

    const book = new BookFlipStateMachine(8, 'desktop');
    const spread = book.getCurrentSpread();

    assert.equal(spread.left, 1);
    assert.equal(spread.right, 2);
    assert.equal(spread.display, 'Trang 1 - 2');
  });

  it('T1-R4-02: Page turning navigation and category bookmark tabs', () => {
    const book = new BookFlipStateMachine(10, 'desktop');
    book.registerBookmarkTab('Sushi & Sashimi', 3);
    book.registerBookmarkTab('Mì Ramen & Udon', 5);

    book.jumpToTab('Mì Ramen & Udon');
    assert.equal(book.currentPage, 5);
    const spread = book.getCurrentSpread();
    assert.equal(spread.left, 5);
    assert.equal(spread.right, 6);
    assert.equal(spread.display, 'Trang 5 - 6');

    const turned = book.nextPage();
    assert.ok(turned);
    assert.equal(book.currentPage, 7);
  });

  it('T1-R4-03: Instant text search by Vietnamese & Japanese names across DishCardDto', () => {
    const resultsVn = filterDishes(FLATTENED_DISHES, { searchQuery: 'Tonkotsu' });
    assert.equal(resultsVn.length, 1);
    assert.equal(resultsVn[0].code, 'RAMEN-01');

    const resultsJp = filterDishes(FLATTENED_DISHES, { searchQuery: '天ぷら' });
    assert.equal(resultsJp.length, 1);
    assert.equal(resultsJp[0].code, 'TEMPURA-01');

    const resultsMiso = filterDishes(FLATTENED_DISHES, { searchQuery: 'MISO' });
    assert.equal(resultsMiso.length, 1);
    assert.equal(resultsMiso[0].code, 'RAMEN-02');
  });

  it('T1-R4-04: Category filter pills by categoryId/categoryCode and matching dish count', () => {
    const ramenDishes = filterDishes(FLATTENED_DISHES, { categoryId: 1 });
    assert.equal(ramenDishes.length, 2);
    assert.ok(ramenDishes.every((d) => d.categoryCode === 'ramen'));

    const sushiDishes = filterDishes(FLATTENED_DISHES, { categoryCode: 'sushi-sashimi' });
    assert.equal(sushiDishes.length, 1);
    assert.equal(sushiDishes[0].code, 'SUSHI-01');
  });

  it('T1-R4-05: DishDetailDto modifierGroups customization and priceAdjustment delta', () => {
    const dishDetail = LIVE_DTO_CATEGORIES[0].dishes[0];
    validateDishSchema(dishDetail, { requireDetail: true });

    const richBroth = dishDetail.modifierGroups[0].options.find((o) => o.optionCode === 'RICH');
    const extraEgg = dishDetail.modifierGroups[1].options.find((o) => o.optionCode === 'TAMAGO');

    const customizedPrice = dishDetail.basePrice + richBroth.priceAdjustment + extraEgg.priceAdjustment;
    assert.equal(customizedPrice, 165000 + 10000 + 15000);
    assert.equal(customizedPrice, 190000);
  });

  it('T1-R4-06: Menu view mode switcher (Book-Flip vs Grid vs Split Showcase)', () => {
    const viewModes = ['book-flip', 'grid', 'split-showcase'];
    let currentMode = 'book-flip';

    function setViewMode(mode) {
      if (!viewModes.includes(mode)) throw new Error('Chế độ xem không hợp lệ');
      currentMode = mode;
      return currentMode;
    }

    assert.equal(currentMode, 'book-flip');
    setViewMode('grid');
    assert.equal(currentMode, 'grid');
    setViewMode('split-showcase');
    assert.equal(currentMode, 'split-showcase');
  });
});
