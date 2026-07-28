import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_NAME, validateBlogSchema } from '../harness/index.mjs';

describe('Tier 2 - Boundary R6: Content & Routing Edge Cases', () => {
  it('T2-R6-01: Non-existent blog article slug/id fallback handling', () => {
    const existingBlogs = [
      {
        id: 1,
        slug: 'sushi-culture',
        title: 'Nghệ thuật Sushi',
        category: 'Cuisine Culture',
        excerpt: 'Khám phá tinh hoa ẩm thực Edomae.',
        content: 'Nội dung chi tiết về nghệ thuật Sushi truyền thống Nhật Bản.',
        authorName: 'Kenji Tanaka',
        readTimeMinutes: 5,
      },
    ];
    validateBlogSchema(existingBlogs[0]);

    function resolveBlogArticle(slugOrId) {
      const article = existingBlogs.find((b) => String(b.id) === String(slugOrId) || b.slug === slugOrId);
      if (!article) {
        return {
          found: false,
          errorCode: 404,
          fallbackMessage: 'Bài viết không tồn tại hoặc đã được chuyển dời',
          backUrl: '/blog',
        };
      }
      return { found: true, article };
    }

    const missing = resolveBlogArticle('non-existent-article-slug-999');
    assert.equal(missing.found, false);
    assert.equal(missing.errorCode, 404);
    assert.equal(missing.backUrl, '/blog');
  });

  it('T2-R6-02: Google Maps iframe security and lazy loading attributes', () => {
    const iframeConfig = {
      src: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724',
      title: `Bản đồ vị trí nhà hàng ${BRAND_NAME}`,
      loading: 'lazy',
      referrerpolicy: 'no-referrer-when-downgrade',
      allowFullScreen: true,
      className: 'w-full h-96 rounded-xl border-0',
    };

    assert.equal(iframeConfig.loading, 'lazy');
    assert.ok(iframeConfig.title.includes('TORI SAKURA'));
    assert.equal(iframeConfig.referrerpolicy, 'no-referrer-when-downgrade');
    assert.ok(iframeConfig.className.includes('w-full'));
  });

  it('T2-R6-03: Multi-branch location tab switching state updates without page reload', () => {
    const branches = [
      { id: 1, code: 'HN-HOANKIEM', name: 'Tori Sakura Hoàn Kiếm', address: '88 Lý Thường Kiệt, Hà Nội' },
      { id: 2, code: 'HCM-BINHTHANH', name: 'Tori Sakura Landmark 81', address: 'Tầng B1, Landmark 81, TP.HCM' },
    ];

    let activeBranchId = 1;
    function switchBranch(id) {
      if (!branches.some((b) => b.id === id)) throw new Error('Chi nhánh không tồn tại');
      activeBranchId = id;
      return branches.find((b) => b.id === activeBranchId);
    }

    assert.equal(activeBranchId, 1);
    const newActive = switchBranch(2);
    assert.equal(activeBranchId, 2);
    assert.equal(newActive.name, 'Tori Sakura Landmark 81');
  });

  it('T2-R6-04: Empty blog category search result handling', () => {
    const articles = [
      { id: 1, title: 'Nghệ thuật Sushi', category: 'Cuisine Culture' },
    ];

    function filterArticlesByCategory(category) {
      const filtered = articles.filter((a) => a.category === category);
      if (filtered.length === 0) {
        return {
          items: [],
          emptyMessage: 'Không có bài viết nào trong chuyên mục này',
          resetCategory: 'ALL',
        };
      }
      return { items: filtered, emptyMessage: null };
    }

    const emptyRes = filterArticlesByCategory('NonExistentCategory');
    assert.equal(emptyRes.items.length, 0);
    assert.ok(emptyRes.emptyMessage.includes('Không có bài viết'));
  });

  it('T2-R6-05: External links security attributes (rel="noopener noreferrer")', () => {
    const externalLinks = [
      { href: 'https://maps.google.com', target: '_blank', rel: 'noopener noreferrer' },
      { href: 'https://facebook.com/torisakura', target: '_blank', rel: 'noopener noreferrer' },
      { href: 'https://instagram.com/torisakura', target: '_blank', rel: 'noopener noreferrer' },
    ];

    for (const link of externalLinks) {
      if (link.target === '_blank') {
        assert.ok(
          link.rel.includes('noopener') && link.rel.includes('noreferrer'),
          `External link "${link.href}" must include rel="noopener noreferrer"`
        );
      }
    }
  });
});
