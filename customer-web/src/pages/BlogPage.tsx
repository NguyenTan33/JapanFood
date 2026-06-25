import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  ArrowRight, 
  X,
  Search,
  Tag,
  Sparkles,
  Utensils,
  Share2,
  Bookmark,
  ChevronRight,
  Heart,
  ShoppingBag
} from 'lucide-react';
import { blogService } from '@/services/blogService';
import { menuService } from '@/services/menuService';
import { BlogPost, Dish } from '@/types';
import { Link } from 'react-router-dom';
import { useCart } from '@/context/CartContext';

export const BlogPage: React.FC = () => {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const { addToCart, setIsCartOpen } = useCart();
  const [addedDishId, setAddedDishId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [posts, dishRes] = await Promise.all([
          blogService.getBlogs(),
          menuService.getDishes({ pageSize: 50 })
        ]);
        if (!isMounted) return;
        setBlogPosts(posts);
        setDishes(dishRes.items);
      } catch (err) {
        console.error('Lỗi tải bài viết blog từ API SQL:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedPost) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPost(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPost]);

  // Categories list
  const categories = [
    { id: 'All', name: 'Tất Cả Bài Viết', kanji: 'すべて' },
    { id: 'Cuisine Culture', name: 'Văn Hóa Ẩm Thực', kanji: '食文化' },
    { id: 'Ingredients & Sourcing', name: 'Nguyên Liệu Thượng Tuyển', kanji: '厳選食材' },
    { id: 'Culinary Art', name: 'Nghệ Thuật Chế Biến', kanji: '料理芸術' },
  ];

  // Filter posts
  const filteredPosts = blogPosts.filter((post) => {
    const matchCategory = selectedCategory === 'All' || post.category === selectedCategory;
    const matchKeyword = !searchKeyword.trim() || 
      post.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      post.summary.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      post.tags.some(t => t.toLowerCase().includes(searchKeyword.toLowerCase()));
    return matchCategory && matchKeyword;
  });

  const featuredPost = filteredPosts[0] || blogPosts[0]; // Hero feature

  // Helper to handle quick add to cart
  const handleQuickAdd = (dish: Dish) => {
    addToCart(dish, [], 1);
    setAddedDishId(dish.id);
    setTimeout(() => setAddedDishId(null), 2000);
    setIsCartOpen(true);
  };

  // Helper to render markdown-like content cleanly
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-3" />;

      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={idx} className="font-serif text-lg sm:text-xl font-bold text-kin-400 mt-6 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-shu-600 rounded-full inline-block" />
            <span>{trimmed.replace('### ', '')}</span>
          </h3>
        );
      }

      if (trimmed.startsWith('> ')) {
        return (
          <blockquote key={idx} className="border-l-4 border-kin-400 bg-sumi-900/90 p-4 my-4 rounded-r-2xl italic text-washi-200 text-xs sm:text-sm shadow-md">
            {trimmed.replace('> ', '')}
          </blockquote>
        );
      }

      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        return (
          <li key={idx} className="ml-5 list-disc text-xs sm:text-sm text-washi-200 leading-relaxed my-1">
            {trimmed.substring(2)}
          </li>
        );
      }

      if (/^\d+\.\s/.test(trimmed)) {
        return (
          <p key={idx} className="text-xs sm:text-sm text-washi-200 leading-relaxed font-semibold mt-3 text-kin-300">
            {trimmed}
          </p>
        );
      }

      return (
        <p key={idx} className="text-xs sm:text-sm text-washi-200 leading-relaxed font-light">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col py-8 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12 sm:space-y-16">
      
      {/* 1. HEADER HERO */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-sumi-900 border border-kin-500/40 text-xs font-semibold text-kin-400 shadow-gold-glow">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Góc Tri Thức Ẩm Thực Nhật Bản • 和食の美学</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-5xl font-bold text-washi-100 leading-tight">
          Chuyện Bếp, Hương Vị & <br />
          <span className="gold-text-gradient">Tinh Hoa Ẩm Thực Phù Tang</span>
        </h1>

        <p className="text-xs sm:text-sm text-washi-300 font-light leading-relaxed max-w-2xl mx-auto">
          Cùng Bếp Trưởng Kenjiro Takahashi khám phá những câu chuyện văn hóa sâu sắc, nghệ thuật chọn cá tại chợ Toyosu và bí quyết thưởng vị chuẩn phong cách hoàng gia Edo.
        </p>
      </div>

      {/* 2. FEATURED HERO ARTICLE (BÀI NỔI BẬT NHẤT) */}
      {featuredPost && (
        <div 
          onClick={() => setSelectedPost(featuredPost)}
          className="group relative bg-gradient-to-r from-sumi-950 via-sumi-900 to-sumi-950 border-2 border-kin-500/40 hover:border-kin-400 rounded-3xl overflow-hidden shadow-2xl cursor-pointer transition-all duration-500"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-center">
            {/* Image */}
            <div className="lg:col-span-7 relative aspect-[16/10] lg:aspect-auto lg:h-full min-h-[300px] overflow-hidden">
              <img
                src={featuredPost.coverImage}
                alt={featuredPost.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-sumi-950/90 via-sumi-950/40 to-transparent" />
              
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-shu-700 text-white border border-kin-500/40 shadow-lg">
                  ★ BÀI VIẾT NỔI BẬT
                </span>
                <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-sumi-900/90 text-kin-300 border border-kin-500/30 backdrop-blur-sm">
                  {featuredPost.category}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="lg:col-span-5 p-6 sm:p-10 space-y-4">
              <div className="flex items-center gap-3 text-xs text-washi-400 font-mono">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-kin-400" />
                  <span>{featuredPost.publishedAt}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-kin-400" />
                  <span>{featuredPost.readTimeMinutes} phút đọc</span>
                </span>
              </div>

              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100 group-hover:text-kin-400 transition-colors leading-snug">
                {featuredPost.title}
              </h2>

              <p className="text-xs sm:text-sm text-washi-300 font-light leading-relaxed line-clamp-3">
                {featuredPost.summary}
              </p>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={featuredPost.author.avatar}
                    alt={featuredPost.author.name}
                    className="w-9 h-9 rounded-full object-cover border border-kin-400 shadow"
                  />
                  <div>
                    <p className="text-xs font-bold text-washi-100">{featuredPost.author.name}</p>
                    <p className="text-[10px] text-kin-400">{featuredPost.author.role}</p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-kin-400 group-hover:text-kin-300 group-hover:translate-x-1 transition-all">
                  <span>Đọc ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-b border-sumi-800 pb-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-shu-700 text-white border border-kin-500/40 shadow-md'
                  : 'text-washi-300 hover:text-white hover:bg-sumi-800/60 bg-sumi-900 border border-sumi-800'
              }`}
            >
              <span>{cat.name}</span>
              <span className="text-[10px] opacity-60 font-kanji hidden sm:inline">({cat.kanji})</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Tìm theo Wagyu, Sushi, Toyosu..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full bg-sumi-900 border border-sumi-700 rounded-xl pl-9 pr-4 py-2 text-xs text-washi-100 placeholder:text-washi-400 focus:outline-none focus:border-kin-400"
          />
          <Search className="w-4 h-4 text-washi-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* 4. ARTICLES GRID */}
      {filteredPosts.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-sumi-900/50 rounded-3xl border border-sumi-800">
          <p className="text-sm text-washi-300">Không tìm thấy bài viết nào phù hợp với từ khóa "{searchKeyword}".</p>
          <button
            onClick={() => {
              setSearchKeyword('');
              setSelectedCategory('All');
            }}
            className="text-xs text-kin-400 underline"
          >
            Xem toàn bộ bài viết
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="group bg-sumi-900/90 border border-kin-500/20 hover:border-kin-500/50 rounded-3xl overflow-hidden shadow-xl hover:shadow-gold-glow transition-all duration-300 flex flex-col justify-between cursor-pointer hover:-translate-y-1"
            >
              <div>
                {/* Image */}
                <div className="relative aspect-[16/10] overflow-hidden bg-sumi-950">
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-sumi-950/80 text-kin-300 border border-kin-500/30 backdrop-blur-sm">
                      {post.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-center gap-3 text-[11px] text-washi-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-kin-400 shrink-0" />
                      <span>{post.publishedAt}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-kin-400 shrink-0" />
                      <span>{post.readTimeMinutes} phút đọc</span>
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-washi-100 group-hover:text-kin-400 transition-colors line-clamp-2 leading-snug">
                    {post.title}
                  </h3>

                  <p className="text-xs text-washi-300 line-clamp-3 leading-relaxed font-light">
                    {post.summary}
                  </p>

                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-sumi-950 border border-sumi-800 text-washi-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Author & Footer */}
              <div className="px-5 sm:px-6 py-4 border-t border-sumi-800/60 mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={post.author.avatar}
                    alt={post.author.name}
                    className="w-7 h-7 rounded-full object-cover border border-kin-400 shrink-0"
                  />
                  <span className="text-xs text-washi-200 truncate">{post.author.name}</span>
                </div>

                <span className="inline-flex items-center gap-1 text-xs font-bold text-kin-400 group-hover:text-kin-300 shrink-0">
                  <span>Chi tiết</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* 5. INVITATION BANNER */}
      <div className="bg-gradient-to-r from-shu-950 via-sumi-900 to-shu-950 border border-kin-500/30 rounded-3xl p-6 sm:p-10 text-center space-y-4">
        <h3 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100">
          Đọc Xong Đã Thấy Thèm Hương Vị Chuẩn Nhật?
        </h3>
        <p className="text-xs sm:text-sm text-washi-300 max-w-xl mx-auto font-light">
          Hãy ghé thăm Tori Sakura ngay hôm nay để trực tiếp cảm nhận độ béo ngậy của bò Wagyu A5 hay độ tươi tan chảy của từng lát cá ngừ O-Toro.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/reservation"
            className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 shadow-gold-glow"
          >
            Đặt Bàn Thưởng Tiệc Ngay
          </Link>
          <Link
            to="/menu"
            className="px-6 py-2.5 rounded-full text-xs font-semibold text-kin-300 bg-sumi-950 border border-kin-500/30 hover:border-kin-400"
          >
            Khám Phá Menu Lật Sách
          </Link>
        </div>
      </div>

      {/* 6. FULL ARTICLE READER MODAL (CHI TIẾT BÀI VIẾT NÂNG CAO) */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => setSelectedPost(null)}
          />

          {/* Modal Container */}
          <div className="relative bg-sumi-950 border-2 border-kin-500/40 rounded-3xl max-w-4xl w-full max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden z-10 text-washi-100">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedPost(null)}
              aria-label="Đóng bài viết"
              className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-sumi-950/80 hover:bg-sumi-800 text-washi-300 hover:text-white border border-kin-500/30 shadow-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Article Hero Banner */}
            <div className="relative h-48 sm:h-72 w-full bg-sumi-950 shrink-0 overflow-hidden">
              <img
                src={selectedPost.coverImage}
                alt={selectedPost.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sumi-950 via-sumi-950/40 to-black/30" />
              
              <div className="absolute bottom-4 left-6 right-6 space-y-1">
                <span className="text-[10px] sm:text-xs font-kanji text-kin-400 font-bold tracking-widest block">
                  {selectedPost.japaneseTitle || '日本の食文化'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-shu-800/90 text-white font-semibold border border-shu-600/50 inline-block">
                  {selectedPost.category}
                </span>
              </div>
            </div>

            {/* Scrollable Article Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-10 space-y-8 custom-scrollbar">
              
              {/* Title & Metadata */}
              <div className="space-y-3 pb-6 border-b border-sumi-800">
                <h1 className="font-serif text-2xl sm:text-4xl font-bold text-washi-100 leading-snug">
                  {selectedPost.title}
                </h1>
                
                {selectedPost.subtitle && (
                  <p className="text-xs sm:text-sm text-kin-300 font-medium italic">
                    "{selectedPost.subtitle}"
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-washi-400">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedPost.author.avatar}
                      alt={selectedPost.author.name}
                      className="w-10 h-10 rounded-full object-cover border border-kin-400"
                    />
                    <div>
                      <p className="font-bold text-washi-100 text-sm">{selectedPost.author.name}</p>
                      <p className="text-[11px] text-kin-400">{selectedPost.author.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-kin-400" />
                      <span>{selectedPost.publishedAt}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-kin-400" />
                      <span>{selectedPost.readTimeMinutes} phút đọc</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Content Formatted */}
              <div className="space-y-4">
                {renderFormattedContent(selectedPost.content)}
              </div>

              {/* Related Dishes Section: Kích thích gọi món ngay */}
              {selectedPost.relatedDishIds && selectedPost.relatedDishIds.length > 0 && (
                <div className="pt-8 border-t border-sumi-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-kanji text-kin-400 tracking-widest font-bold">おすすめ料理</span>
                      <h4 className="font-serif text-lg font-bold text-washi-100">
                        Thưởng Thức Hương Vị Trong Bài Viết Này
                      </h4>
                    </div>
                    <Link
                      to="/menu"
                      className="text-xs text-kin-300 hover:text-kin-200 underline font-medium"
                    >
                      Xem toàn bộ Menu
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {dishes
                      .filter((d) => selectedPost.relatedDishIds.includes(d.id))
                      .slice(0, 2)
                      .map((dish) => (
                        <div
                          key={dish.id}
                          className="p-3.5 rounded-2xl bg-sumi-900/90 border border-kin-500/30 flex items-center gap-3.5 hover:border-kin-400 transition-all shadow-md"
                        >
                          <img
                            src={dish.imageUrl}
                            alt={dish.name}
                            className="w-16 h-16 rounded-xl object-cover border border-kin-500/20 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h5 className="font-serif text-sm font-bold text-washi-100 truncate">{dish.name}</h5>
                            <p className="text-xs text-kin-400 font-bold">{dish.price.toLocaleString('vi-VN')}₫</p>
                            <button
                              onClick={() => handleQuickAdd(dish)}
                              className="mt-1.5 px-3 py-1 rounded-lg text-[10px] font-bold text-white bg-shu-700 hover:bg-shu-600 flex items-center gap-1 transition-all"
                            >
                              <ShoppingBag className="w-3 h-3" />
                              <span>{addedDishId === dish.id ? 'Đã thêm!' : 'Thêm Vào Giỏ'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tags & Modal Footer */}
              <div className="pt-6 border-t border-sumi-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-1.5">
                  {selectedPost.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2.5 py-1 rounded-lg bg-sumi-900 border border-sumi-700 text-kin-300"
                    >
                      #{t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPost(null)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-washi-300 hover:text-white bg-sumi-900 border border-sumi-700"
                  >
                    Đóng Bài Viết
                  </button>

                  <Link
                    to="/reservation"
                    className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-gold-glow flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Đặt Bàn Thưởng Vị</span>
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
