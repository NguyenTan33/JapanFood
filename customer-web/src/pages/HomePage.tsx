import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Calendar, 
  Star, 
  ArrowRight, 
  Utensils, 
  Award, 
  Sparkles, 
  CheckCircle2, 
  Users, 
  Clock, 
  ShoppingBag,
  Flame,
  MapPin,
  Navigation,
  Phone,
  Map,
  Loader2
} from 'lucide-react';
import { menuService } from '@/services/menuService';
import { branchService } from '@/services/branchService';
import { restaurantInfoService, RestaurantInfoDto } from '@/services/restaurantInfoService';
import { Dish, Category, BranchLocation } from '@/types';
import { DishDetailModal } from '@/components/modals/DishDetailModal';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { getLocalDateString } from '@/utils/dateUtils';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);

  const todayStr = getLocalDateString();

  // Dynamic Data States from SQL Server API
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [branches, setBranches] = useState<BranchLocation[]>([]);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfoDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick reservation bar state
  const [quickBranch, setQuickBranch] = useState('');
  const [quickDate, setQuickDate] = useState(todayStr);
  const [quickTime, setQuickTime] = useState('19:00');
  const [quickGuests, setQuickGuests] = useState('2');

  // Featured homepage map state
  const [homeMapBranchId, setHomeMapBranchId] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadHomeData() {
      try {
        const [catList, dishRes, branchList, restInfo] = await Promise.all([
          menuService.getCategories(),
          menuService.getDishes({ pageSize: 50 }),
          branchService.getBranches(),
          restaurantInfoService.getRestaurantInfo(),
        ]);

        if (!isMounted) return;
        setCategories(catList);
        setDishes(dishRes.items);
        setBranches(branchList);
        setRestaurantInfo(restInfo);

        if (branchList.length > 0) {
          setQuickBranch(branchList[0].id);
          setHomeMapBranchId(branchList[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu trang chủ từ API SQL:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadHomeData();
    return () => { isMounted = false; };
  }, []);

  const activeHomeBranch = branches.find((b) => b.id === homeMapBranchId) || branches[0];
  const featuredDishes = dishes.filter((d) => d.isFeatured);

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

  const handleQuickReservationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('login', 'Quý khách vui lòng đăng nhập để đặt bàn giữ chỗ.');
      return;
    }
    if (quickDate < todayStr) {
      alert('Ngày đặt bàn không thể ở quá khứ. Hệ thống đã tự động chuyển về ngày hôm nay.');
      setQuickDate(todayStr);
      return;
    }
    navigate(`/reservation?branch=${quickBranch}&date=${quickDate}&time=${quickTime}&guests=${quickGuests}`);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 1. HERO SECTION */}
      <section className="relative min-h-[75vh] sm:min-h-[85vh] flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24">
        {/* Japanese Glow Background & Seigaiha Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,30,30,0.3)_0%,rgba(18,18,20,0.95)_75%)] pointer-events-none" />
        <div className="absolute inset-0 japanese-pattern-seigaiha opacity-20 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center space-y-7 z-10">
          {/* Kanji & Subtitle Badge */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 max-w-full rounded-full border border-kin-500/40 bg-sumi-900/90 backdrop-blur-md text-xs font-medium text-kin-400 shadow-gold-glow animate-fade-in">
            <span className="font-kanji font-bold text-base">桜鳥</span>
            <span className="w-1.5 h-1.5 rounded-full bg-shu-500 shrink-0" />
            <span>Tinh Hoa Ẩm Thực Nhật Bản • Toyosu Fresh Daily</span>
          </div>

          {/* Main Title */}
          <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-washi-100 leading-tight">
            Nghệ Thuật Ẩm Thực <br />
            <span className="gold-text-gradient">Tinh Hoa Xứ Phù Tang</span>
          </h1>

          {/* Description */}
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-washi-300 leading-relaxed font-light">
            Chào mừng quý khách đến với <strong className="text-kin-400 font-semibold">{restaurantInfo?.brandName || 'TORI SAKURA JAPANESE DINING'}</strong>. 
            Thưởng thức Sashimi cá ngừ O-Toro hảo hạng bay từ chợ Toyosu Tokyo, bò Wagyu A5 Miyazaki vân mỡ cẩm thạch và chén rượu Sake ủ thùng gỗ tuyết tùng.
          </p>

          {/* CTAs */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/menu"
              className="inline-flex items-center space-x-2.5 px-7 py-3.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/50 shadow-xl shadow-shu-950/80 hover:shadow-gold-glow transition-all duration-300 group"
            >
              <BookOpen className="w-4 h-4 text-kin-300 group-hover:rotate-12 transition-transform" />
              <span>Khám Phá Menu Lật Sách 3D</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  openAuthModal('login', 'Quý khách vui lòng đăng nhập để đặt bàn giữ chỗ.');
                  return;
                }
                navigate('/reservation');
              }}
              className="inline-flex items-center space-x-2 px-7 py-3.5 rounded-full text-sm font-semibold text-kin-400 hover:text-kin-300 bg-sumi-900/90 hover:bg-sumi-800 border border-kin-500/40 shadow-lg hover:border-kin-400 transition-all duration-300"
            >
              <Calendar className="w-4 h-4" />
              <span>Đặt Bàn Trực Tuyến</span>
            </button>
          </div>

          {/* Quick Stats */}
          <div className="pt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto border-t border-kin-500/20">
            <div className="p-3.5 rounded-xl bg-sumi-900/60 border border-sumi-800 backdrop-blur-sm text-center">
              <p className="text-2xl sm:text-3xl font-bold font-sans tracking-tight text-kin-400">{dishes.length > 0 ? `${dishes.length}+` : '32+'}</p>
              <p className="text-xs text-washi-400 mt-0.5">Món ăn chuẩn vị</p>
            </div>
            <div className="p-3.5 rounded-xl bg-sumi-900/60 border border-sumi-800 backdrop-blur-sm text-center">
              <p className="text-2xl sm:text-3xl font-bold font-sans tracking-tight text-kin-400">18h</p>
              <p className="text-xs text-washi-400 mt-0.5">Hầm nước dùng Tonkotsu</p>
            </div>
            <div className="p-3.5 rounded-xl bg-sumi-900/60 border border-sumi-800 backdrop-blur-sm text-center">
              <p className="text-2xl sm:text-3xl font-bold font-sans tracking-tight text-kin-400">A5</p>
              <p className="text-xs text-washi-400 mt-0.5">Bò Wagyu Miyazaki BMS 9+</p>
            </div>
            <div className="p-3.5 rounded-xl bg-sumi-900/60 border border-sumi-800 backdrop-blur-sm text-center">
              <p className="text-2xl sm:text-3xl font-bold font-sans tracking-tight text-kin-400">4.9</p>
              <p className="text-xs text-washi-400 mt-0.5">Đánh giá thực khách</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. QUICK RESERVATION BAR */}
      <section className="relative -mt-8 z-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
        <form
          onSubmit={handleQuickReservationSubmit}
          className="bg-sumi-900/95 border border-kin-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
        >
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-kin-400 mb-1">
              Chi nhánh
            </label>
            <select
              value={quickBranch}
              onChange={(e) => setQuickBranch(e.target.value)}
              className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:border-kin-400 focus:outline-none"
            >
              {branches.map((b: BranchLocation) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-kin-400 mb-1">
              Ngày thưởng thức
            </label>
            <input
              type="date"
              min={todayStr}
              value={quickDate}
              onChange={(e) => {
                const val = e.target.value;
                setQuickDate(val < todayStr ? todayStr : val);
              }}
              className="w-full min-w-0 max-w-full [color-scheme:dark] bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:border-kin-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-kin-400 mb-1">
              Khung giờ
            </label>
            <select
              value={quickTime}
              onChange={(e) => setQuickTime(e.target.value)}
              className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:border-kin-400 focus:outline-none"
            >
              <option value="11:30">11:30 (Trưa)</option>
              <option value="12:30">12:30 (Trưa)</option>
              <option value="18:00">18:00 (Tối)</option>
              <option value="19:00">19:00 (Tối)</option>
              <option value="20:00">20:00 (Tối)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-kin-400 mb-1">
              Số lượng khách
            </label>
            <select
              value={quickGuests}
              onChange={(e) => setQuickGuests(e.target.value)}
              className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:border-kin-400 focus:outline-none"
            >
              <option value="1">1 khách (Quầy Bar Omakase)</option>
              <option value="2">2 khách (Bàn đôi ấm cúng)</option>
              <option value="4">4 khách (Bàn tiệc gia đình)</option>
              <option value="6">6 khách (Phòng Tatami)</option>
              <option value="10">10+ khách (Tiệc đoàn VIP)</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 shadow-lg flex items-center justify-center space-x-1.5 transition-colors whitespace-nowrap"
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Tìm Bàn Trống</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. CATEGORY SHOWCASE */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-widest text-kin-400 font-semibold">Thế Giới Ẩm Thực</span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-washi-100 mt-2">
            <span className="font-sans font-bold text-kin-400">{categories.length}</span> Danh Mục Món Nhật Đặc Sắc
          </h2>
          <p className="text-xs sm:text-sm text-washi-300 mt-2">
            Từ những lát Sashimi tươi rói đến thố cơm Donburi nóng hổi và chén rượu Sake thơm nồng.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-kin-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/menu?category=${cat.id}`}
                className="group relative rounded-2xl overflow-hidden aspect-[4/3] border border-kin-500/20 hover:border-kin-500/60 shadow-lg hover:shadow-gold-glow transition-all duration-300"
              >
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-sumi-950 via-sumi-950/50 to-transparent group-hover:via-sumi-950/40 transition-colors" />

                <div className="absolute bottom-3 left-3 right-3">
                  <span className="text-[10px] font-kanji text-kin-400">{cat.japaneseName}</span>
                  <h3 className="font-serif text-sm sm:text-base font-bold text-white group-hover:text-kin-400 transition-colors line-clamp-1">
                    {cat.name}
                  </h3>
                  <p className="text-[11px] text-washi-300 mt-0.5">{cat.dishCount} món ăn</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. FEATURED BEST SELLERS */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-sumi-900/40 border-y border-kin-500/15">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-4 border-b border-kin-500/20">
            <div>
              <span className="text-xs uppercase tracking-widest text-kin-400 font-semibold">Bếp Trưởng Tuyển Chọn</span>
              <h2 className="font-serif text-3xl font-bold text-washi-100 mt-1">Tuyệt Phẩm Best Seller</h2>
            </div>
            <Link
              to="/menu"
              className="inline-flex items-center space-x-1.5 text-xs sm:text-sm text-kin-400 hover:text-kin-300 font-semibold mt-3 md:mt-0 group"
            >
              <span>Xem thực đơn lật sách 3D</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(featuredDishes.length > 0 ? featuredDishes : dishes).slice(0, 8).map((dish) => (
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
                    {dish.tags.slice(0, 2).map((tag) => (
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

                  <div className="pt-4 mt-3 border-t border-sumi-800 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-washi-400 line-through">
                        {dish.originalPrice ? `${dish.originalPrice.toLocaleString('vi-VN')}₫` : ''}
                      </p>
                      <p className="text-base font-bold text-kin-400">
                        {dish.price.toLocaleString('vi-VN')}₫
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickAdd(dish)}
                      className="p-2.5 rounded-xl bg-shu-700/80 hover:bg-shu-600 text-white border border-kin-500/30 transition-colors shadow-md"
                      title="Chọn món"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. BRANCHES & MAP SHOWCASE */}
      {activeHomeBranch && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs uppercase tracking-widest text-kin-400 font-semibold font-mono">
              Hệ Thống Chi Nhánh • 拠点のご案内
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-washi-100 mt-2">
              Hiện Diện Tại <span className="font-sans font-bold text-kin-400">{branches.length}</span> Vị Trí Vàng Đắc Địa
            </h2>
            <p className="text-xs sm:text-sm text-washi-300 mt-2">
              Mời quý khách ghé thăm không gian thanh tịnh chuẩn phong cách cố đô Kyoto tại Sài Gòn & Thủ đô Hà Nội.
            </p>
          </div>

          {/* Branch Selector Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {branches.map((b) => {
              const isSelected = b.id === homeMapBranchId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setHomeMapBranchId(b.id)}
                  className={`p-4 rounded-2xl text-left transition-all border flex items-start space-x-3.5 ${
                    isSelected
                      ? 'bg-shu-950/80 border-kin-500/80 shadow-gold-glow'
                      : 'bg-sumi-900/60 border-sumi-800 hover:border-kin-500/30'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isSelected
                        ? 'bg-shu-700 text-white border-kin-400 shadow-md'
                        : 'bg-sumi-950 text-washi-400 border-sumi-700'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-kanji text-kin-400/90 truncate">{b.japaneseName}</p>
                    <h4 className="font-serif text-xs sm:text-sm font-bold text-washi-100 truncate">{b.name}</h4>
                    <p className="text-[11px] text-washi-400 truncate mt-0.5">{b.address}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Map Frame with Prominent Red Point Location Marker */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Branch Info Card */}
            <div className="lg:col-span-5 p-6 sm:p-8 rounded-3xl bg-sumi-900/90 border border-kin-500/30 flex flex-col justify-between space-y-6 shadow-2xl">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-kanji text-kin-400 font-bold">{activeHomeBranch.japaneseName}</span>
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-washi-100">{activeHomeBranch.name}</h3>
                  <p className="text-xs text-washi-300 mt-1">{activeHomeBranch.address}, {activeHomeBranch.city}</p>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-sumi-800 text-xs text-washi-300">
                  <div className="flex items-center space-x-2.5">
                    <Phone className="w-4 h-4 text-kin-400 shrink-0" />
                    <span>Hotline đặt bàn: <strong className="text-kin-300">{activeHomeBranch.hotline}</strong></span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <Clock className="w-4 h-4 text-kin-400 shrink-0" />
                    <span>Trưa: {activeHomeBranch.openingHours.lunch} • Tối: {activeHomeBranch.openingHours.dinner}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2.5">
                <Link
                  to={`/reservation?branch=${activeHomeBranch.id}`}
                  className="flex-1 py-3 px-4 rounded-xl text-center text-xs font-bold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 shadow-lg transition-colors whitespace-nowrap"
                >
                  Đặt Bàn Tại Chi Nhánh Này
                </Link>
                <a
                  href={activeHomeBranch.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl text-xs font-semibold text-kin-300 bg-sumi-800 hover:bg-sumi-700 border border-kin-500/30 flex items-center space-x-1.5 transition-colors whitespace-nowrap"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Chỉ Đường</span>
                </a>
              </div>
            </div>

            {/* Interactive Map with Animated Red Pin Location */}
            <div className="lg:col-span-7 bg-sumi-950 border border-kin-500/30 rounded-3xl overflow-hidden shadow-2xl relative min-h-[340px] sm:min-h-[420px] min-w-0">
              <iframe
                title={`Bản đồ ${activeHomeBranch.name}`}
                src={activeHomeBranch.googleMapsEmbedUrl}
                width="100%"
                height="100%"
                className="w-full h-full min-h-[340px] sm:min-h-[420px] border-0"
                loading="lazy"
                allowFullScreen
              />

              {/* Top-left: Live Status Badge */}
              <div className="absolute top-4 left-4 bg-sumi-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-kin-500/40 text-[11px] font-semibold text-kin-400 shadow-lg flex items-center space-x-1.5 pointer-events-none z-20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span>Google Maps Trực Tuyến</span>
              </div>

              {/* Prominent Red Point Location Marker */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-20 flex flex-col items-center">
                <div className="px-3.5 py-1.5 rounded-xl bg-sumi-950/95 border border-kin-400/80 text-white text-xs font-bold shadow-2xl flex items-center space-x-2 whitespace-nowrap mb-1.5 backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-shu-500 animate-ping shrink-0" />
                  <span className="text-kin-300 font-kanji">桜</span>
                  <span>{activeHomeBranch.name}</span>
                </div>
                
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-12 h-12 rounded-full bg-shu-500/40 animate-ping" />
                  <span className="absolute w-8 h-8 rounded-full bg-shu-600/60 animate-pulse" />
                  <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-shu-500 via-shu-700 to-shu-900 border-2 border-white shadow-2xl flex items-center justify-center text-white">
                    <MapPin className="w-5 h-5 text-kin-300 fill-shu-600 drop-shadow" />
                  </div>
                </div>

                <div className="w-2.5 h-2.5 bg-shu-800 rotate-45 -mt-1 border-r border-b border-kin-400" />
                <div className="w-3.5 h-1.5 rounded-full bg-black/70 blur-[1px] mt-0.5" />
              </div>

              {/* Bottom-right: Open External Google Maps Button */}
              <a
                href={activeHomeBranch.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-4 right-4 bg-sumi-900/95 hover:bg-shu-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-kin-500/40 text-xs font-semibold text-kin-300 hover:text-white shadow-2xl flex items-center space-x-1.5 transition-all z-20 group"
              >
                <Navigation className="w-3.5 h-3.5 text-kin-400 group-hover:rotate-45 transition-transform" />
                <span>Mở Trên Google Maps</span>
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Dish Detail Modal */}
      <DishDetailModal
        dish={selectedDish}
        onClose={() => setSelectedDish(null)}
      />
    </div>
  );
};
