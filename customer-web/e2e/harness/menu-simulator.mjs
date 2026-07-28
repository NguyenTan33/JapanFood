import assert from 'node:assert/strict';

export function removeVietnameseDiacritics(str = '') {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export class BookFlipStateMachine {
  constructor(totalPages = 10, mode = 'desktop') {
    assert.ok(totalPages >= 1, 'Total pages must be at least 1');
    this.totalPages = totalPages;
    this.mode = mode; // 'desktop' (2 pages per spread) or 'mobile' (single page)
    this.currentPage = 1;
    this.history = [1];
    this.bookmarkTabs = new Map();
  }

  registerBookmarkTab(tabName, targetPage) {
    assert.ok(targetPage >= 1 && targetPage <= this.totalPages, `Target page ${targetPage} out of bounds`);
    this.bookmarkTabs.set(tabName, targetPage);
  }

  jumpToTab(tabName) {
    if (!this.bookmarkTabs.has(tabName)) {
      throw new Error(`Bookmark tab "${tabName}" not found`);
    }
    const targetPage = this.bookmarkTabs.get(tabName);
    return this.goToPage(targetPage);
  }

  nextPage() {
    const step = this.mode === 'desktop' ? 2 : 1;
    if (this.currentPage + step <= this.totalPages) {
      this.currentPage += step;
      this.history.push(this.currentPage);
      return true;
    }
    return false;
  }

  prevPage() {
    const step = this.mode === 'desktop' ? 2 : 1;
    if (this.currentPage - step >= 1) {
      this.currentPage -= step;
      this.history.push(this.currentPage);
      return true;
    }
    return false;
  }

  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.history.push(this.currentPage);
      return true;
    }
    return false;
  }

  getCurrentSpread() {
    if (this.mode === 'desktop') {
      const left = this.currentPage % 2 === 0 ? this.currentPage - 1 : this.currentPage;
      const right = left + 1 <= this.totalPages ? left + 1 : null;
      const spreadIndex = Math.floor((left - 1) / 2);
      return { left, right, spreadIndex, display: `Trang ${left}${right ? ` - ${right}` : ''}` };
    }
    return { current: this.currentPage, display: `Trang ${this.currentPage}` };
  }
}

export function filterDishes(dishes, { searchQuery = '', categoryId = 'all', categoryCode = 'all', minPrice = 0, maxPrice = Infinity, tags = [] }) {
  const rawQ = searchQuery.trim().toLowerCase();
  const normalizedQ = removeVietnameseDiacritics(rawQ);

  return dishes.filter((d) => {
    const nameLower = d.name.toLowerCase();
    const nameNormalized = removeVietnameseDiacritics(nameLower);
    const jpNameLower = (d.japaneseName || '').toLowerCase();
    const descLower = (d.shortDescription || d.description || '').toLowerCase();
    const descNormalized = removeVietnameseDiacritics(descLower);

    const matchesSearch = !rawQ ||
      nameLower.includes(rawQ) ||
      nameNormalized.includes(normalizedQ) ||
      jpNameLower.includes(rawQ) ||
      descLower.includes(rawQ) ||
      descNormalized.includes(normalizedQ);

    const matchesCategoryId = categoryId === 'all' || d.categoryId === categoryId;
    const matchesCategoryCode = categoryCode === 'all' || d.categoryCode === categoryCode;
    const effectivePrice = d.basePrice ?? d.price ?? 0;
    const matchesPrice = effectivePrice >= minPrice && effectivePrice <= maxPrice;
    const matchesTags = tags.length === 0 || tags.every((t) => (d.tags || []).includes(t));

    return matchesSearch && matchesCategoryId && matchesCategoryCode && matchesPrice && matchesTags;
  });
}
