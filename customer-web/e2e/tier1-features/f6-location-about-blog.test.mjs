import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND_NAME,
  validateLocationSchema,
  validateBlogSchema,
  assertContainsText,
} from '../harness/index.mjs';

const LIVE_BRANCH_DTOS = [
  {
    id: 1,
    code: 'HN-HOANKIEM',
    name: 'Tori Sakura Hoàn Kiếm (Flagship)',
    japaneseName: '鳥桜 本店',
    address: '88 Lý Thường Kiệt, Quận Hoàn Kiếm, Hà Nội',
    district: 'Hoàn Kiếm',
    city: 'Hà Nội',
    phone: '024-3939-1111',
    openingHours: '10:30 - 14:00 | 17:00 - 22:00',
    parkingInfo: 'Tầng hầm xe máy miễn phí & bãi đỗ ô tô đối diện',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724.1234567',
    mapDirectionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=21.0245,105.8412',
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
    isMainBranch: true,
  },
  {
    id: 2,
    code: 'HCM-BINHTHANH',
    name: 'Tori Sakura Landmark 81',
    japaneseName: '鳥桜 ランドマーク81支店',
    address: 'Tầng B1, Vincom Landmark 81, 720A Điện Biên Phủ, Bình Thạnh, TP.HCM',
    district: 'Bình Thạnh',
    city: 'TP. Hồ Chí Minh',
    phone: '028-3838-2222',
    openingHours: '10:30 - 14:00 | 17:00 - 22:00',
    parkingInfo: 'Hầm B2 & B3 Vincom Center',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.7654321',
    mapDirectionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=10.7950,106.7218',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
    isMainBranch: false,
  },
];

const LIVE_BLOG_DTOS = [
  {
    id: 1,
    slug: 'art-of-edomae-sushi',
    title: 'Nghệ thuật thưởng thức Sushi đúng chuẩn Edomae',
    japaneseSubtitle: '江戸前寿司の芸術',
    category: 'Cuisine Culture',
    excerpt: 'Khám phá bí quyết lên men cơm giấm Akazu và kỹ thuật ủ cá truyền thống.',
    content: 'Edomae Sushi ra đời từ thời kỳ Edo tại Tokyo với quy trình ủ cá tinh xảo và cơm giấm đỏ Akazu...',
    coverImageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c',
    authorName: 'Master Chef Kenji Tanaka',
    publishedAt: '2026-10-15T08:00:00Z',
    readTimeMinutes: 6,
    tags: ['Sushi', 'Edomae', 'SUSHI-01'],
  },
];

describe('Tier 1 - Feature R2/R4: Location (BranchDto), About Us, and Blog (BlogPostDto)', () => {
  it('T1-R6-01: BranchDto Google Maps embed & directions URL validation', () => {
    for (const branch of LIVE_BRANCH_DTOS) {
      validateLocationSchema(branch);
      assert.match(branch.mapEmbedUrl, /^https:\/\/(www\.)?google\.com\/maps\/embed/);
      assert.match(branch.mapDirectionsUrl, /^https:\/\/(www\.)?google\.com\/maps/);
    }
  });

  it('T1-R6-02: BranchDto information, operating hours, and parking details', () => {
    const flagship = LIVE_BRANCH_DTOS[0];
    assert.ok(flagship.name.includes('Tori Sakura'));
    assert.equal(flagship.isMainBranch, true);
    assert.ok(flagship.phone.includes('024'));
    assert.match(flagship.openingHours, /10:30 - 14:00/);
    assert.ok(flagship.parkingInfo.length > 0);
  });

  it('T1-R6-03: About Us heritage story and culinary philosophy (Omotenashi, Wabi-Sabi)', () => {
    const aboutContent = {
      brandName: BRAND_NAME,
      title: 'Hành Trình Tinh Hoa Ẩm Thực Nhật Bản',
      values: [
        { name: 'Omotenashi', description: 'Lòng hiếu khách thuần khiết và chân thành từ trái tim.' },
        { name: 'Wabi-Sabi', description: 'Vẻ đẹp mộc mạc, tĩnh lặng và thanh tao trong không gian kiến trúc.' },
        { name: 'Kodawari', description: 'Sự kiên định theo đuổi chuẩn mực hoàn hảo trong từng món ăn.' },
      ],
      headChef: 'Master Chef Kenji Tanaka - 30 năm kinh nghiệm ẩm thực truyền thống Tokyo',
    };

    assert.equal(aboutContent.brandName, 'TORI SAKURA JAPANESE DINING');
    assertContainsText(aboutContent.title, 'Tinh Hoa Ẩm Thực');
    assert.equal(aboutContent.values.length, 3);
    assert.ok(aboutContent.values.some((v) => v.name === 'Omotenashi'));
    assert.ok(aboutContent.values.some((v) => v.name === 'Wabi-Sabi'));
  });

  it('T1-R6-04: About Us ambience gallery and Toyosu ingredient sourcing', () => {
    const sourcingCards = [
      { ingredient: 'Hải sản tươi sống', origin: 'Chợ đầu mối Toyosu, Tokyo, Nhật Bản' },
      { ingredient: 'Thịt bò Wagyu A5', origin: 'Tỉnh Kagoshima, Nhật Bản' },
      { ingredient: 'Gạo Koshihikari', origin: 'Tỉnh Niigata, Nhật Bản' },
    ];

    assert.equal(sourcingCards.length, 3);
    assert.ok(sourcingCards[0].origin.includes('Toyosu'));
    assert.ok(sourcingCards[1].ingredient.includes('Wagyu A5'));
  });

  it('T1-R6-05: BlogPostDto schema validation and category metadata', () => {
    const blog = LIVE_BLOG_DTOS[0];
    validateBlogSchema(blog);
    assert.equal(blog.category, 'Cuisine Culture');
    assert.equal(blog.authorName, 'Master Chef Kenji Tanaka');
    assert.equal(blog.readTimeMinutes, 6);
  });

  it('T1-R6-06: Blog detail article reader with deep-link dish tags', () => {
    const blog = LIVE_BLOG_DTOS[0];
    assert.equal(blog.slug, 'art-of-edomae-sushi');
    assert.ok(blog.content.length > 20);
    assert.ok(blog.excerpt.length > 10);
    assert.ok(blog.tags.includes('SUSHI-01'));
  });
});
