import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  BookOpen, 
  LayoutGrid, 
  Star, 
  Clock, 
  ShoppingBag, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Flame,
  ArrowUpDown,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { menuService } from '@/services/menuService';
import { Dish, Category } from '@/types';
import { DishDetailModal } from '@/components/modals/DishDetailModal';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export const MenuPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { isAuthenticated, openAuthModal } = useAuth();

  // Dynamic Data States from SQL Server API
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State
  const [viewMode, setViewMode] = useState<'book' | 'grid'>('book');
  const [selectedCategory, setSelectedCategory] = useState<string>(() => searchParams.get('category') || 'all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [priceRange, setPriceRange] = useState<string>('all'); // 'all' | 'under200' | '200to500' | 'above500'
  const [sortBy, setSortBy] = useState<string>('popular');
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchMenu() {
      try {
        const [catList, dishRes] = await Promise.all([
          menuService.getCategories(),
          menuService.getDishes({ pageSize: 100 })
        ]);
        if (!isMounted) return;
        setCategories(catList);
        setDishes(dishRes.items);
      } catch (err) {
        console.error('Lỗi tải menu từ API SQL:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchMenu();
    return () => { isMounted = false; };
  }, []);

  // Category horizontal scroll state & helpers
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkCategoryScroll = () => {
    const el = categoryScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  };

  useEffect(() => {
    checkCategoryScroll();
    window.addEventListener('resize', checkCategoryScroll);
    return () => window.removeEventListener('resize', checkCategoryScroll);
  }, []);

  const handleScrollCategories = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const scrollAmount = 260;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
    setTimeout(checkCategoryScroll, 350);
  };

  const handleQuickAdd = (dish: Dish) => {
    if (!isAuthenticated) {
      openAuthModal('login', 'Quý khách vui lòng đăng nhập để thêm món vào giỏ hàng và đặt món.');
      return;
    }
    if (dish.optionGroups && dish.optionGroups.length > 0) {
      setSelectedDish(dish);
      return;
    }
    addToCart(dish);
  };

  // Book-flip state
  const [currentBookPage, setCurrentBookPage] = useState(0);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const [isFlipping, setIsFlipping] = useState(false);

  // Sync category param
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) {
      setSelectedCategory(cat);
      setCurrentBookPage(0);
    }
  }, [searchParams]);

  // Reset book page on any filter change
  useEffect(() => {
    setCurrentBookPage(0);
  }, [selectedCategory, searchKeyword, priceRange]);

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      // Category match
      if (selectedCategory !== 'all') {
        const sel = selectedCategory.toLowerCase();
        const dishCatId = (dish.categoryId || '').toLowerCase();
        const dishCatName = (dish.categoryName || '').toLowerCase();
        const match = dishCatId === sel || dishCatName === sel || dishCatId.includes(sel) || sel.includes(dishCatId);
        if (!match) return false;
      }
      // Keyword match
      if (searchKeyword.trim()) {
        const query = searchKeyword.toLowerCase();
        const matchName = dish.name?.toLowerCase().includes(query);
        const matchJp = dish.japaneseName?.toLowerCase().includes(query);
        const matchDesc = dish.description?.toLowerCase().includes(query);
        const matchCode = dish.code?.toLowerCase().includes(query);
        if (!matchName && !matchJp && !matchDesc && !matchCode) return false;
      }
      // Price range
      if (priceRange === 'under200' && dish.price >= 200000) return false;
      if (priceRange === '200to500' && (dish.price < 200000 || dish.price > 500000)) return false;
      if (priceRange === 'above500' && dish.price <= 500000) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'rating_desc') return (b.rating || 0) - (a.rating || 0);
      // Default: popular
      return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
    });
  }, [dishes, selectedCategory, searchKeyword, priceRange, sortBy]);

  // Book pages: each "page" in book view shows 2 dishes (spread view: 1 left, 1 right)
  const totalBookPages = Math.ceil(filteredDishes.length / 2) || 1;

  const currentLeftDish = filteredDishes[currentBookPage * 2];
  const currentRightDish = filteredDishes[currentBookPage * 2 + 1];

  const handleNextPage = () => {
    if (currentBookPage < totalBookPages - 1 && !isFlipping) {
      setFlipDirection('next');
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentBookPage((prev) => prev + 1);
      }, 220);
      setTimeout(() => {
        setIsFlipping(false);
      }, 480);
    }
  };

  const handlePrevPage = () => {
    if (currentBookPage > 0 && !isFlipping) {
      setFlipDirection('prev');
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentBookPage((prev) => prev - 1);
      }, 220);
      setTimeout(() => {
        setIsFlipping(false);
      }, 480);
    }
  };

  // Keyboard navigation for book flip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'book') return;
      if (e.key === 'ArrowRight') handleNextPage();
      if (e.key === 'ArrowLeft') handlePrevPage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, currentBookPage, totalBookPages, isFlipping]);

  return (
    <div className="flex-1 flex flex-col py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Title & View Switcher Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-kin-500/20 gap-4">
        <div className="min-w-0">
          <div className="flex items-center space-x-2 text-xs font-semibold text-kin-400 uppercase tracking-widest">
            <span className="font-kanji">お品書き</span>
            <span>•</span>
            <span>Thực Đơn Omakase & Kaiseki</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl font-bold text-washi-100 mt-1">
            Tuyển Tập Ẩm Thực Cố Đô
          </h1>
          <p className="text-xs text-washi-300 mt-1">
            Tìm thấy <strong className="text-kin-400">{filteredDishes.length}</strong> món ăn thượng hạng sẵn sàng phục vụ
          </p>
        </div>

        {/* View Mode Toggle Button */}
        <div className="flex items-center w-full md:w-auto bg-sumi-900 border border-kin-500/30 rounded-xl p-1 shadow-lg">
          <button
            type="button"
            aria-label="Cuốn Menu 3D (Lật Sách)"
            onClick={() => setViewMode('book')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              viewMode === 'book'
                ? 'bg-gradient-to-r from-shu-700 to-shu-600 text-white shadow-md'
                : 'text-washi-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="sm:hidden">Menu 3D</span>
            <span className="hidden sm:inline">Cuốn Menu 3D (Lật Sách)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              viewMode === 'grid'
                ? 'bg-gradient-to-r from-shu-700 to-shu-600 text-white shadow-md'
                : 'text-washi-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
            <span>Danh Sách Lưới</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter & Search Bar */}
      <div className="mt-6 bg-sumi-900/80 border border-kin-500/25 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        {/* Search Input, Sort Dropdown & Collapsible Filter Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          <div className="relative sm:col-span-2 lg:col-span-2 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-washi-400 pointer-events-none" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentBookPage(0);
              }}
              placeholder="Tìm món (Sashimi, Ramen, Wagyu A5...)"
              className="w-full bg-sumi-950 border border-sumi-700 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-xs text-washi-100 placeholder:text-washi-500 focus:outline-none focus:border-kin-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <ArrowUpDown className="w-4 h-4 text-kin-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full min-w-0 bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
            >
              <option value="popular">Sắp xếp: Món Phổ Biến Nhất</option>
              <option value="price_asc">Giá: Thấp đến Cao</option>
              <option value="price_desc">Giá: Cao đến Thấp</option>
              <option value="rating_desc">Đánh giá: Cao nhất (5 sao)</option>
            </select>
          </div>

          {/* Toggle Collapsible Advanced Filter Button */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
              showAdvancedFilters || priceRange !== 'all'
                ? 'bg-shu-900/80 text-kin-300 border-kin-500/50 shadow-md'
                : 'bg-sumi-950 text-washi-300 border-sumi-700 hover:border-kin-500/30'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-kin-400 shrink-0" />
            <span>Lọc Nâng Cao</span>
            {priceRange !== 'all' && (
              <span className="w-2 h-2 rounded-full bg-kin-400 shrink-0" />
            )}
            {showAdvancedFilters ? (
              <ChevronUp className="w-3.5 h-3.5 ml-1 text-washi-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-1 text-washi-400" />
            )}
          </button>
        </div>

        {/* Category Pills Bar with Smooth Left/Right Buttons & Wheel Scroll */}
        <div className="relative group/cats pt-1">
          {/* Left Arrow Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScrollCategories('left')}
              aria-label="Cuộn danh mục sang trái"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-sumi-950/95 border border-kin-500/50 text-kin-300 hover:text-white hover:bg-shu-700 shadow-xl flex items-center justify-center transition-all backdrop-blur-sm -ml-2 sm:-ml-3"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Right Arrow Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScrollCategories('right')}
              aria-label="Cuộn danh mục sang phải"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-sumi-950/95 border border-kin-500/50 text-kin-300 hover:text-white hover:bg-shu-700 shadow-xl flex items-center justify-center transition-all backdrop-blur-sm -mr-2 sm:-mr-3"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Left and Right Edge Fade Gradients */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-sumi-900 via-sumi-900/60 to-transparent pointer-events-none z-[5]" />
          )}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-sumi-900 via-sumi-900/60 to-transparent pointer-events-none z-[5]" />
          )}

          <div
            ref={categoryScrollRef}
            onScroll={checkCategoryScroll}
            onWheel={(e) => {
              if (e.deltaY !== 0 && categoryScrollRef.current) {
                categoryScrollRef.current.scrollLeft += e.deltaY;
                checkCategoryScroll();
              }
            }}
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none scroll-smooth select-none px-1"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setCurrentBookPage(0);
                setSearchParams({});
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all border ${
                selectedCategory === 'all'
                  ? 'bg-shu-700 text-white border-kin-500/50 shadow-md'
                  : 'bg-sumi-950 text-washi-300 border-sumi-700 hover:border-kin-500/30'
              }`}
            >
              Tất Cả ({dishes.length})
            </button>

            {categories.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setCurrentBookPage(0);
                  setSearchParams({ category: cat.id });
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all border flex items-center space-x-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-shu-700 text-white border-kin-500/50 shadow-md'
                    : 'bg-sumi-950 text-washi-300 border-sumi-700 hover:border-kin-500/30'
                }`}
              >
                <span className="font-kanji text-[11px] text-kin-300">{cat.japaneseName.split('・')[0]}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Advanced Filters (Khách cần thì mở ra) */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-sumi-800/80 space-y-3 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-washi-400">
                <span className="font-semibold text-kin-400 whitespace-nowrap mr-1">Khoảng giá:</span>
                {[
                  { id: 'all', label: 'Tất cả giá' },
                  { id: 'under200', label: 'Dưới 200.000₫' },
                  { id: '200to500', label: '200.000₫ - 500.000₫' },
                  { id: 'above500', label: 'Trên 500.000₫ (Cao cấp)' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setPriceRange(item.id);
                      setCurrentBookPage(0);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap shrink-0 border transition-all ${
                      priceRange === item.id
                        ? 'bg-kin-500/20 text-kin-300 border-kin-500/50 font-bold shadow-sm'
                        : 'border-sumi-800 bg-sumi-950/70 text-washi-400 hover:text-washi-200 hover:border-sumi-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {priceRange !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setPriceRange('all');
                    setCurrentBookPage(0);
                  }}
                  className="text-xs text-washi-400 hover:text-shu-400 underline transition-colors"
                >
                  Xóa bộ lọc giá
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* VIEW MODE 1: 3D BOOK FLIP MENU (Tham chiếu trải nghiệm JapanFood.mp4) */}
      {/* ===================================================================== */}
      {viewMode === 'book' && (
        <div className="mt-8 flex flex-col items-center">
          {/* Book Controller Header */}
          <div className="w-full max-w-5xl flex items-center justify-between gap-3 mb-4 px-1 sm:px-2">
            <div className="flex items-center gap-2 min-w-0 text-xs text-washi-300">
              <span className="w-1.5 h-1.5 rounded-full bg-kin-400/80 shrink-0" />
              <span>
                Chế độ lướt thực đơn 3D
                <span className="hidden sm:inline">: Dùng phím mũi tên ← → hoặc nút bấm bên dưới để lật trang</span>
              </span>
            </div>

            <div className="text-xs font-mono font-bold text-kin-400 bg-sumi-900 border border-kin-500/30 px-3 py-1 rounded-full shrink-0 whitespace-nowrap">
              Trang {currentBookPage + 1} / {totalBookPages}
            </div>
          </div>

          {/* Book Frame */}
          <div className="relative w-full max-w-5xl bg-sumi-900/95 rounded-3xl border-2 border-kin-500/40 p-4 sm:p-8 shadow-2xl shadow-black overflow-hidden backdrop-blur-xl menu-book-cover menu-book-perspective">
            {/* Book Spine Center with Gold Thread Stitch Simulation & Crease */}
            <div className="hidden lg:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-7 bg-gradient-to-r from-sumi-950 via-[#0a0a0c] to-sumi-950 z-20 pointer-events-none border-x border-kin-500/30 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
              <div className="h-full w-full flex flex-col justify-around items-center py-6 opacity-60">
                <div className="w-1.5 h-6 rounded-full bg-kin-500/40 border border-kin-400/30" />
                <div className="w-1.5 h-6 rounded-full bg-kin-500/40 border border-kin-400/30" />
                <div className="w-1.5 h-6 rounded-full bg-kin-500/40 border border-kin-400/30" />
                <div className="w-1.5 h-6 rounded-full bg-kin-500/40 border border-kin-400/30" />
              </div>
            </div>

            {/* Corner Gold Embellishments */}
            <div className="absolute top-2 left-2 text-kin-500/40 text-xl font-kanji select-none pointer-events-none">❖</div>
            <div className="absolute top-2 right-2 text-kin-500/40 text-xl font-kanji select-none pointer-events-none">❖</div>
            <div className="absolute bottom-2 left-2 text-kin-500/40 text-xl font-kanji select-none pointer-events-none">❖</div>
            <div className="absolute bottom-2 right-2 text-kin-500/40 text-xl font-kanji select-none pointer-events-none">❖</div>

            {/* Book Content Spreads */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 items-stretch">
              {/* Left Spread */}
              {currentLeftDish ? (
                <div
                  className={`relative bg-gradient-to-br from-sumi-900/90 via-sumi-950/95 to-sumi-900/90 border border-kin-500/25 rounded-2xl p-4 sm:p-6 flex flex-col justify-between space-y-4 hover:border-kin-500/40 transition-all min-w-0 menu-book-page-leaf ${
                    isFlipping && flipDirection === 'prev' ? 'menu-flip-prev-leaf' : ''
                  }`}
                >
                  {/* Spine inner shadow crease */}
                  <div className="hidden lg:block absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/50 via-black/20 to-transparent pointer-events-none rounded-r-2xl" />

                  <div>
                    <div className="relative aspect-[16/10] rounded-xl overflow-hidden mb-4 border border-kin-500/20 shadow-md">
                      <img
                        src={currentLeftDish.imageUrl}
                        alt={currentLeftDish.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-kanji text-kin-400 font-bold truncate">{currentLeftDish.japaneseName}</p>
                        <h3 className="font-serif text-xl sm:text-2xl font-bold text-washi-100 mt-0.5">
                          {currentLeftDish.name}
                        </h3>
                      </div>
                      <span className="text-base sm:text-lg font-bold text-kin-400 shrink-0 whitespace-nowrap">
                        {currentLeftDish.price.toLocaleString('vi-VN')}₫
                      </span>
                    </div>

                    <p className="text-xs text-washi-300 mt-2 leading-relaxed">
                      {currentLeftDish.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-washi-400 mt-3 pt-3 border-t border-sumi-800">
                      <span className="flex items-center space-x-1 text-kin-400">
                        <Star className="w-3.5 h-3.5 fill-kin-400" />
                        <span className="font-bold">{currentLeftDish.rating}</span>
                      </span>
                      <span>•</span>
                      <span>{currentLeftDish.preparationTimeMinutes} phút</span>
                      <span>•</span>
                      <span>{currentLeftDish.categoryName}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDish(currentLeftDish)}
                        className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-kin-300 bg-sumi-900 hover:bg-sumi-800 border border-kin-500/30 transition-colors whitespace-nowrap"
                      >
                        Tùy chọn Topping
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(currentLeftDish)}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 flex items-center space-x-1 transition-colors whitespace-nowrap shrink-0"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                        <span>Thêm</span>
                      </button>
                    </div>

                    <div className="hidden sm:flex justify-between items-center text-[10px] text-kin-500/60 font-mono pt-1 border-t border-sumi-800/60">
                      <span>❖ SAKURA DINING</span>
                      <span>Trang {currentBookPage * 2 + 1}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-washi-500 text-xs">Hết món</div>
              )}

              {/* Right Spread */}
              {currentRightDish ? (
                <div
                  className={`relative bg-gradient-to-bl from-sumi-900/90 via-sumi-950/95 to-sumi-900/90 border border-kin-500/25 rounded-2xl p-4 sm:p-6 flex flex-col justify-between space-y-4 hover:border-kin-500/40 transition-all min-w-0 menu-book-page-leaf ${
                    isFlipping && flipDirection === 'next' ? 'menu-flip-next-leaf' : ''
                  }`}
                >
                  {/* Spine inner shadow crease */}
                  <div className="hidden lg:block absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/50 via-black/20 to-transparent pointer-events-none rounded-l-2xl" />

                  <div>
                    <div className="relative aspect-[16/10] rounded-xl overflow-hidden mb-4 border border-kin-500/20 shadow-md">
                      <img
                        src={currentRightDish.imageUrl}
                        alt={currentRightDish.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-kanji text-kin-400 font-bold truncate">{currentRightDish.japaneseName}</p>
                        <h3 className="font-serif text-xl sm:text-2xl font-bold text-washi-100 mt-0.5">
                          {currentRightDish.name}
                        </h3>
                      </div>
                      <span className="text-base sm:text-lg font-bold text-kin-400 shrink-0 whitespace-nowrap">
                        {currentRightDish.price.toLocaleString('vi-VN')}₫
                      </span>
                    </div>

                    <p className="text-xs text-washi-300 mt-2 leading-relaxed">
                      {currentRightDish.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-washi-400 mt-3 pt-3 border-t border-sumi-800">
                      <span className="flex items-center space-x-1 text-kin-400">
                        <Star className="w-3.5 h-3.5 fill-kin-400" />
                        <span className="font-bold">{currentRightDish.rating}</span>
                      </span>
                      <span>•</span>
                      <span>{currentRightDish.preparationTimeMinutes} phút</span>
                      <span>•</span>
                      <span>{currentRightDish.categoryName}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDish(currentRightDish)}
                        className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-kin-300 bg-sumi-900 hover:bg-sumi-800 border border-kin-500/30 transition-colors whitespace-nowrap"
                      >
                        Tùy chọn Topping
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(currentRightDish)}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 flex items-center space-x-1 transition-colors whitespace-nowrap shrink-0"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                        <span>Thêm</span>
                      </button>
                    </div>

                    <div className="hidden sm:flex justify-between items-center text-[10px] text-kin-500/60 font-mono pt-1 border-t border-sumi-800/60">
                      <span>Trang {currentBookPage * 2 + 2}</span>
                      <span>OMAKASE & KAISEKI ❖</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-washi-500 text-xs border border-dashed border-sumi-800 rounded-2xl">
                  <Sparkles className="w-6 h-6 text-kin-400/50 mb-2" />
                  <span>Trang cuối cùng của danh mục này</span>
                </div>
              )}
            </div>

            {/* Book Flip Navigation Buttons */}
            <div className="mt-6 sm:mt-8 flex items-center justify-between gap-2 pt-4 border-t border-kin-500/20">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentBookPage === 0 || isFlipping}
                className="px-3 sm:px-4 py-2.5 rounded-xl text-xs font-semibold text-kin-300 bg-sumi-950 border border-kin-500/30 hover:border-kin-400 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 transition-all shadow-md"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>
                  Trang trước <span className="hidden sm:inline">(←)</span>
                </span>
              </button>

              {/* Page indicator pills */}
              <div className="hidden sm:flex items-center flex-wrap justify-center gap-1.5">
                {Array.from({ length: totalBookPages }).map((_, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setCurrentBookPage(idx)}
                    aria-label={`Trang ${idx + 1}`}
                    className={`h-2.5 rounded-full transition-all ${
                      currentBookPage === idx
                        ? 'w-6 bg-kin-400 shadow-gold-glow'
                        : 'w-2.5 bg-sumi-700 hover:bg-sumi-600'
                    }`}
                    title={`Trang ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentBookPage >= totalBookPages - 1 || isFlipping}
                className="px-3 sm:px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 transition-all shadow-md"
              >
                <span>
                  Trang kế tiếp <span className="hidden sm:inline">(→)</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW MODE 2: GRID VIEW */}
      {/* ===================================================================== */}
      {viewMode === 'grid' && (
        <div className="mt-8">
          {filteredDishes.length === 0 ? (
            <div className="py-20 text-center bg-sumi-900/40 rounded-2xl border border-sumi-800">
              <Search className="w-10 h-10 text-washi-500 mx-auto mb-3" />
              <h3 className="font-serif text-lg font-semibold text-washi-200">Không tìm thấy món ăn phù hợp</h3>
              <p className="text-xs text-washi-400 mt-1">
                Vui lòng thử từ khóa khác hoặc bỏ các bộ lọc để xem toàn bộ thực đơn.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchKeyword('');
                  setPriceRange('all');
                }}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-kin-300 bg-sumi-800 border border-kin-500/30"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredDishes.map((dish) => (
                <div
                  key={dish.id}
                  className="group bg-sumi-900/90 rounded-2xl border border-kin-500/20 hover:border-kin-500/60 overflow-hidden shadow-xl hover:shadow-gold-glow transition-all duration-300 flex flex-col justify-between"
                >
                  <div
                    className="relative aspect-[4/3] overflow-hidden bg-sumi-950 cursor-pointer"
                    onClick={() => setSelectedDish(dish)}
                  >
                    <img
                      src={dish.imageUrl}
                      alt={dish.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                      {dish.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-shu-800/90 text-kin-200 border border-shu-600/50 backdrop-blur-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-sumi-950/80 text-[11px] font-medium text-kin-300 flex items-center space-x-1 backdrop-blur-sm">
                      <Star className="w-3 h-3 text-kin-400 fill-kin-400" />
                      <span>{dish.rating}</span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="cursor-pointer" onClick={() => setSelectedDish(dish)}>
                      <p className="text-[10px] font-kanji text-kin-400/90 mb-0.5">{dish.japaneseName}</p>
                      <h3 className="font-serif text-base font-semibold text-washi-100 group-hover:text-kin-400 transition-colors line-clamp-1">
                        {dish.name}
                      </h3>
                      <p className="text-xs text-washi-300/80 mt-1 line-clamp-2 leading-relaxed">
                        {dish.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-sumi-800 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-sm font-bold text-kin-400 whitespace-nowrap">
                          {dish.price.toLocaleString('vi-VN')}₫
                        </span>
                        {dish.originalPrice && (
                          <span className="text-[11px] text-washi-500 line-through whitespace-nowrap">
                            {dish.originalPrice.toLocaleString('vi-VN')}₫
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedDish(dish)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-kin-300 bg-sumi-800 hover:bg-sumi-700 border border-kin-500/20 whitespace-nowrap"
                        >
                          Topping
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(dish)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-shu-700 hover:bg-shu-600 text-white border border-kin-500/30 flex items-center space-x-1 transition-all whitespace-nowrap"
                        >
                          <ShoppingBag className="w-3 h-3 shrink-0" />
                          <span>Thêm</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dish Detail Modal */}
      <DishDetailModal
        dish={selectedDish}
        onClose={() => setSelectedDish(null)}
      />
    </div>
  );
};
