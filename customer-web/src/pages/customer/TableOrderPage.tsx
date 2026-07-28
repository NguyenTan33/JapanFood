import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Wifi,
  WifiOff,
  Bell,
  CreditCard,
  Utensils,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  Minus,
  Sparkles,
  ShoppingBag,
  Flame,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { menuService } from '@/services/menuService';
import { posService, PosTable } from '@/services/posService';
import { wifiConfigService } from '@/services/wifiConfigService';
import { apiClient } from '@/services/apiClient';
import { Dish, Category, CartItemOption } from '@/types';
import { formatVND } from '@/utils/dateUtils';
import { DishDetailModal } from '@/components/modals/DishDetailModal';

export interface TableOrderCartItem {
  cartItemId: string;
  dish: Dish;
  quantity: number;
  selectedOptions: CartItemOption[];
  specialInstructions?: string;
  unitPrice: number;
  totalPrice: number;
}

interface OrderedItem {
  id: number;
  name: string;
  japaneseName?: string;
  quantity: number;
  price: number;
  total: number;
  status: 'Pending' | 'Cooking' | 'Ready' | 'Served';
  modifiers?: string;
  specialInstructions?: string;
}

export const TableOrderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tableIdParam = searchParams.get('tableId') || '1';
  const tableId = parseInt(tableIdParam, 10);
  const sessionToken = searchParams.get('token') || '';

  // WiFi Verification state (Xác thực kết nối mạng nội bộ quán qua Public WAN IP)
  const [activeSsids, setActiveSsids] = useState<string[]>([]);
  const [isWifiValid, setIsWifiValid] = useState<boolean>(true);
  const [isVerifyingWifi, setIsVerifyingWifi] = useState<boolean>(false);

  // Table info - Loaded dynamically from backend
  const [table, setTable] = useState<PosTable | null>(null);
  const [orderedItems, setOrderedItems] = useState<OrderedItem[]>([]);
  const [isLoadingTable, setIsLoadingTable] = useState<boolean>(true);
  const [orderSubmitting, setOrderSubmitting] = useState<boolean>(false);

  // Menu items for calling additional dishes
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const isFetchingSessionRef = useRef<boolean>(false);

  // Cart for new items being added at table
  const [cart, setCart] = useState<TableOrderCartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [selectedDishModal, setSelectedDishModal] = useState<Dish | null>(null);

  // Buzz Kitchen rate limit (3 minutes cooldown = 180 seconds)
  const [buzzCountdown, setBuzzCountdown] = useState<number>(0);
  const [buzzSuccessMsg, setBuzzSuccessMsg] = useState<string | null>(null);

  // Call Bill modal
  const [isBillRequested, setIsBillRequested] = useState<boolean>(false);

  // Check rate limit timer on mount
  useEffect(() => {
    const key = `torisakura_buzz_table_${tableId}`;
    const lastBuzz = Number(localStorage.getItem(key) || '0');
    const elapsed = Date.now() - lastBuzz;
    const cooldownMs = 3 * 60 * 1000;
    if (elapsed < cooldownMs) {
      setBuzzCountdown(Math.ceil((cooldownMs - elapsed) / 1000));
    }
  }, [tableId]);

  // Countdown timer tick
  useEffect(() => {
    if (buzzCountdown <= 0) return;
    const interval = setInterval(() => {
      setBuzzCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [buzzCountdown > 0]);

  // Load menu (Load all dishes with full modifier groups and options)
  useEffect(() => {
    menuService.getCategories().then((c) => setCategories(c)).catch(() => {});
    menuService.getDishes({ pageSize: 200 }).then((res) => setDishes(res.items)).catch(() => {});
  }, []);

  // Load table session dynamically from backend
  const loadTableAndOrder = useCallback(async () => {
    if (!tableId || isNaN(tableId) || isFetchingSessionRef.current) return;
    isFetchingSessionRef.current = true;
    try {
      const { data } = await apiClient.get<any>('/orders/table-qr-session', {
        params: { tableId, token: sessionToken },
      });
      if (data) {
        setTable({
          tableId: data.tableId,
          tableNumber: data.tableNumber,
          areaName: data.areaName,
          capacity: data.capacity,
          minCapacity: 1,
          areaId: 0,
          status: data.status,
          currentOrderId: data.currentOrderId,
          openedAt: data.openedAt,
          totalAmount: data.totalAmount,
        });

        if (Array.isArray(data.items)) {
          setOrderedItems(
            data.items.map((it: any) => ({
              id: it.id,
              name: it.name,
              japaneseName: it.japaneseName,
              quantity: it.quantity,
              price: it.price,
              total: it.total,
              status: it.status,
              modifiers: it.modifiers,
              specialInstructions: it.specialInstructions,
            }))
          );
        }

        if (Array.isArray(data.activeSsids) && data.activeSsids.length > 0) {
          setActiveSsids(data.activeSsids);
        }
        setIsWifiValid(data.isWifiValid ?? true);
      }
    } catch (err: any) {
      if (err?.response?.status !== 429) {
        console.error('Lỗi tải thông tin phiên bàn:', err);
      }
    } finally {
      isFetchingSessionRef.current = false;
      setIsLoadingTable(false);
    }
  }, [tableId, sessionToken]);

  useEffect(() => {
    void loadTableAndOrder();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void loadTableAndOrder();
      }
    }, 6000); // Polling live status from kitchen/POS every 6s when tab is visible
    return () => clearInterval(interval);
  }, [loadTableAndOrder]);

  // Verify WiFi Network
  const verifyWifiNetwork = async () => {
    setIsVerifyingWifi(true);
    try {
      const [ssids, verifyRes] = await Promise.all([
        wifiConfigService.getActiveSsids(1).catch(() => []),
        wifiConfigService.verifyNetwork(1).catch(() => ({ isAllowed: true })),
      ]);
      if (ssids && ssids.length > 0) {
        setActiveSsids(ssids);
      }
      setIsWifiValid(verifyRes?.isAllowed ?? true);
    } catch {
      setIsWifiValid(true);
    } finally {
      setIsVerifyingWifi(false);
    }
  };

  useEffect(() => {
    void verifyWifiNetwork();
  }, []);

  // Format countdown mm:ss
  const formatCountdown = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Handle Buzz Kitchen (Giục Món / Nhắc Bếp) — gửi lên server, KDS rung thẻ món của bàn 7s
  const [isBuzzing, setIsBuzzing] = useState(false);
  const handleBuzzKitchen = async () => {
    if (buzzCountdown > 0 || isBuzzing) return;
    setIsBuzzing(true);
    const res = await posService.buzzKitchen(tableId, sessionToken);
    setIsBuzzing(false);
    if (res.success || res.cooldownSeconds > 0) {
      const cd = res.cooldownSeconds || 180;
      localStorage.setItem(`torisakura_buzz_table_${tableId}`, String(Date.now() - (180 - cd) * 1000));
      setBuzzCountdown(cd);
    }
    if (res.success) {
      setBuzzSuccessMsg('🔔 Đã gửi yêu cầu ưu tiên tới Bếp Trưởng!');
      setTimeout(() => setBuzzSuccessMsg(null), 5000);
    } else {
      alert(res.message);
    }
  };

  // Handle Call Bill (Gọi Tính Tiền) — POS thu ngân nhận popup
  const [isCallingBill, setIsCallingBill] = useState(false);
  const handleCallBill = async () => {
    if (isCallingBill) return;
    setIsCallingBill(true);
    const res = await posService.callBill(tableId, sessionToken);
    setIsCallingBill(false);
    if (res.success) {
      setIsBillRequested(true);
    } else {
      alert(res.message);
    }
  };

  // Add dish to local cart via Customization Modal
  const handleAddToCartModal = (
    dish: Dish,
    selectedOptions: CartItemOption[],
    quantity: number,
    specialInstructions?: string
  ) => {
    const optIdsKey = selectedOptions.map((o) => o.optionId).sort().join('_');
    const noteKey = (specialInstructions || '').trim().toLowerCase();
    const cartItemId = `${dish.id}-${optIdsKey}-${noteKey}`;

    const optionAddon = selectedOptions.reduce((acc, opt) => acc + (opt.priceAdjustment || 0), 0);
    const unitPrice = dish.price + optionAddon;

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.cartItemId === cartItemId);
      if (existingIdx >= 0) {
        const next = [...prev];
        const newQty = next[existingIdx].quantity + quantity;
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: newQty,
          totalPrice: unitPrice * newQty,
        };
        return next;
      }
      return [
        ...prev,
        {
          cartItemId,
          dish,
          quantity,
          selectedOptions,
          specialInstructions: (specialInstructions || '').trim() || undefined,
          unitPrice,
          totalPrice: unitPrice * quantity,
        },
      ];
    });
    setSelectedDishModal(null);
  };

  const handleUpdateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const nextQty = item.quantity + delta;
            return {
              ...item,
              quantity: nextQty,
              totalPrice: item.unitPrice * nextQty,
            };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  // Send Order to Kitchen (Real API: POST /api/orders/table-qr-order)
  const handleSendOrder = async () => {
    if (cart.length === 0 || orderSubmitting) return;
    setOrderSubmitting(true);
    try {
      const payload = {
        tableId,
        token: sessionToken,
        clientSsid: activeSsids[0] || 'ToriSakura_Guest_5G',
        items: cart.map((c) => ({
          menuItemId: c.dish.id,
          quantity: c.quantity,
          modifierOptionIds: c.selectedOptions.map((o) => o.optionId),
          specialInstructions: c.specialInstructions || undefined,
        })),
        notes: undefined,
      };

      const { data } = await apiClient.post<any>('/orders/table-qr-order', payload);
      setCart([]);
      setIsCartOpen(false);
      alert(data?.message || 'Đã gửi món vào bếp thành công! Đầu bếp đang bắt đầu chuẩn bị món ăn cho bạn.');
      await loadTableAndOrder();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể gửi món vào bếp. Vui lòng kiểm tra lại trạng thái bàn hoặc kết nối WiFi quán.';
      alert(msg);
    } finally {
      setOrderSubmitting(false);
    }
  };

  const totalCurrentBill = orderedItems.reduce((acc, curr) => acc + curr.total, 0);

  const filteredDishes = dishes.filter((dish) => {
    const matchCat = selectedCategory === 'all' || dish.categoryId === selectedCategory;
    const matchSearch =
      !searchQuery.trim() ||
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dish.japaneseName && dish.japaneseName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-sumi-950 text-washi-100 font-sans pb-32">
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-40 bg-sumi-900/95 backdrop-blur-md border-b border-sumi-800 shadow-xl">
        {/* Brand & Table bar */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-shu-700 text-white flex items-center justify-center font-bold shadow-md">
              <Utensils className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white">{table?.tableNumber || `BÀN #${tableId}`}</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-shu-950 text-shu-300 border border-shu-800">
                  Dine-In
                </span>
              </div>
              <p className="text-[11px] text-washi-400">
                {table?.areaName || 'Khu Vực Ẩm Thực'} • Sakura Japanese Fine Dining
              </p>
            </div>
          </div>

          {/* Quick bill preview */}
          <div className="text-right">
            <span className="text-[10px] text-washi-400 uppercase block">Tạm Tính:</span>
            <span className="font-mono font-black text-sm text-kin-300">
              {formatVND(totalCurrentBill)}
            </span>
          </div>
        </div>
      </header>

      {/* 2. IF NOT CONNECTED TO RESTAURANT WIFI: SHOW CLEAR WIFI GUIDANCE */}
      {!isWifiValid ? (
        <main className="p-6 max-w-md mx-auto text-center space-y-6 pt-12 animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-shu-950/80 border-2 border-shu-500/50 flex items-center justify-center text-shu-400 shadow-2xl">
            <WifiOff className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase text-washi-100 tracking-wide">
              Yêu Cầu Kết Nối WiFi Nhà Hàng
            </h2>
            <p className="text-xs text-washi-300 leading-relaxed">
              Để bảo mật và đảm bảo món ăn được phục vụ chính xác tại bàn, quý khách vui lòng kết nối vào mạng WiFi nội bộ của nhà hàng để xem thực đơn và gọi món.
            </p>
          </div>

          {/* WiFi Details Card */}
          <div className="bg-sumi-900 border border-kin-500/40 rounded-2xl p-5 text-left space-y-3 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-kin-400 flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              <span>Thông Tin Mạng WiFi Quán</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-sumi-800">
                <span className="text-washi-400">Tên WiFi (SSID):</span>
                <span className="font-mono font-bold text-white bg-sumi-950 px-2.5 py-1 rounded border border-sumi-700">
                  {activeSsids.length > 0 ? activeSsids.join(' hoặc ') : 'ToriSakura_Guest_5G'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-sumi-800">
                <span className="text-washi-400">Mật khẩu (Password):</span>
                <span className="font-mono font-bold text-kin-300 bg-sumi-950 px-2.5 py-1 rounded border border-sumi-700">
                  sakura8888
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 text-[11px] text-washi-400">
                <span>Chi nhánh:</span>
                <span>Flagship Lê Thánh Tôn - Q.1</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void verifyWifiNetwork()}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isVerifyingWifi ? 'animate-spin' : ''}`} />
            <span>Tôi Đã Kết Nối WiFi Quán, Kiểm Tra Lại!</span>
          </button>
        </main>
      ) : (
        /* 3. IF WIFI VALID: MAIN DINE-IN ORDERING & LIVE TRACKER */
        <main className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
          {/* Success Buzz Alert Toast */}
          {buzzSuccessMsg && (
            <div className="p-3 bg-emerald-950 border border-emerald-500 text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{buzzSuccessMsg}</span>
            </div>
          )}

          {/* ACTION BUTTONS BAR: GIỤC MÓN (3P RATE LIMIT) & GỌI TÍNH TIỀN */}
          <div className="grid grid-cols-2 gap-3">
            {/* Chuông Giục Món (3 phút 1 lần) */}
            <button
              type="button"
              onClick={() => void handleBuzzKitchen()}
              disabled={buzzCountdown > 0 || isBuzzing}
              className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2.5 font-bold text-xs transition-all shadow-lg active:scale-95 ${
                buzzCountdown > 0
                  ? 'bg-sumi-900 border-sumi-800 text-washi-500 cursor-not-allowed opacity-80'
                  : 'bg-amber-950/80 hover:bg-amber-900 border-amber-500/60 text-amber-200 shadow-amber-950/50'
              }`}
            >
              <Bell className={`w-4 h-4 ${buzzCountdown === 0 ? 'text-amber-400 animate-bounce' : 'text-slate-500'}`} />
              <div className="text-left">
                <span>{buzzCountdown > 0 ? `Đã Giục Món (${formatCountdown(buzzCountdown)})` : 'Chuông Giục Món'}</span>
                <span className="block text-[10px] text-washi-400 font-normal">
                  {buzzCountdown > 0 ? 'Giới hạn 3 phút/lần' : 'Nhắc bếp làm nhanh'}
                </span>
              </div>
            </button>

            {/* Gọi Tính Tiền */}
            <button
              type="button"
              onClick={() => void handleCallBill()}
              disabled={isCallingBill}
              className="p-3.5 rounded-2xl border bg-shu-950/80 hover:bg-shu-900 border-shu-500/60 text-shu-200 flex items-center justify-center gap-2.5 font-bold text-xs transition-all shadow-lg shadow-shu-950/50 active:scale-95 disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4 text-shu-400" />
              <div className="text-left">
                <span>{isCallingBill ? 'Đang gửi...' : 'Gọi Tính Tiền'}</span>
                <span className="block text-[10px] text-washi-400 font-normal">
                  Nhân viên đến bàn
                </span>
              </div>
            </button>
          </div>

          {/* SECTION: LIVE ORDER STATUS TRACKER (Món đã gọi & Trạng thái bếp) */}
          <div className="bg-sumi-900/90 border border-sumi-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-sumi-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-kin-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Trạng Thái Món Ăn Bàn Bạn Đã Gọi ({orderedItems.length} món)</span>
              </h3>
              <span className="text-[11px] text-emerald-400 font-semibold">Cập nhật trực tiếp</span>
            </div>

            {orderedItems.length === 0 ? (
              <div className="py-8 text-center text-washi-400">
                <Utensils className="w-8 h-8 mx-auto text-washi-600 mb-2 opacity-50" />
                <p className="text-xs font-semibold">Chưa có món nào được gọi vào bàn này.</p>
                <p className="text-[11px] text-washi-500 mt-1">
                  Hãy chọn các món ăn ngon từ thực đơn bên dưới và bấm "Gửi Gọi Món Xuống Bếp Ngay"!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-sumi-800 space-y-2">
                {orderedItems.map((item) => (
                  <div key={item.id} className="pt-2.5 first:pt-0 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-washi-100">{item.name}</span>
                        <span className="font-black text-xs px-2 py-0.5 rounded bg-sumi-800 text-kin-400">
                          x{item.quantity}
                        </span>
                      </div>
                      {item.modifiers && (
                        <p className="text-[11px] text-washi-400 italic mt-0.5">
                          + {item.modifiers}
                        </p>
                      )}
                      {item.specialInstructions && (
                        <p className="text-[11px] text-amber-300 font-semibold mt-0.5">
                          Ghi chú: {item.specialInstructions}
                        </p>
                      )}
                      <p className="text-[11px] text-washi-500 mt-0.5 font-mono">
                        Thành tiền: {formatVND(item.total)}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'Served'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : item.status === 'Ready'
                            ? 'bg-blue-950 text-blue-300 border border-blue-700 animate-pulse'
                            : item.status === 'Cooking'
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : 'bg-sumi-800 text-washi-300 border border-sumi-700'
                        }`}
                      >
                        {item.status === 'Served' && <CheckCircle2 className="w-3 h-3" />}
                        {item.status === 'Ready' && <Sparkles className="w-3 h-3" />}
                        {item.status === 'Cooking' && <Flame className="w-3 h-3 text-orange-400" />}
                        {item.status === 'Pending' && <Clock className="w-3 h-3" />}
                        <span>
                          {item.status === 'Served'
                            ? 'Đã Phục Vụ'
                            : item.status === 'Ready'
                            ? 'Đã Nấu Xong'
                            : item.status === 'Cooking'
                            ? 'Đang Nấu'
                            : 'Chờ Bếp'}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION: BROWSE MENU & CALL MORE FOOD */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-washi-100 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-kin-400" />
                <span>Thực Đơn Gọi Thêm Món Vào Bàn</span>
              </h3>
            </div>

            {/* Category filter pills & search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-shu-700 text-white'
                      : 'bg-sumi-900 border border-sumi-800 text-washi-400 hover:text-washi-200'
                  }`}
                >
                  Tất Cả
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                      selectedCategory === c.id
                        ? 'bg-shu-700 text-white'
                        : 'bg-sumi-900 border border-sumi-800 text-washi-400 hover:text-washi-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-washi-500" />
                <input
                  type="text"
                  placeholder="Tìm món ngon..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-sumi-900 border border-sumi-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-washi-100 outline-none focus:border-kin-500"
                />
              </div>
            </div>

            {/* Dishes list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredDishes.map((dish) => (
                <div
                  key={dish.id}
                  onClick={() => setSelectedDishModal(dish)}
                  className="bg-sumi-900/80 border border-sumi-800 rounded-xl p-3 flex flex-col justify-between hover:border-kin-500/50 hover:shadow-lg hover:shadow-black/40 transition-all cursor-pointer group"
                >
                  {dish.imageUrl && (
                    <div className="h-28 w-full rounded-lg overflow-hidden mb-2 bg-sumi-950">
                      <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-start justify-between gap-1.5">
                      <h4 className="font-bold text-xs text-washi-100 line-clamp-1 group-hover:text-kin-400 transition-colors">
                        {dish.name}
                      </h4>
                      {dish.optionGroups && dish.optionGroups.length > 0 && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-kin-950/80 border border-kin-500/40 text-kin-300">
                          Topping
                        </span>
                      )}
                    </div>
                    {dish.japaneseName && (
                      <p className="text-[10px] text-kin-400/80 line-clamp-1">{dish.japaneseName}</p>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-sumi-800 flex items-center justify-between">
                    <span className="font-bold text-xs text-shu-400 font-mono">
                      {formatVND(dish.price)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDishModal(dish);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-shu-700 hover:bg-shu-600 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{dish.optionGroups && dish.optionGroups.length > 0 ? 'Tùy Chọn' : 'Chọn'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FLOATING CART BAR BUTTON */}
          {cart.length > 0 && !isCartOpen && (
            <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 animate-fade-in">
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="w-full bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 text-white rounded-2xl shadow-2xl border-2 border-kin-500/60 p-4 flex items-center justify-between transition-all active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-sumi-950/80 border border-kin-400 flex items-center justify-center text-kin-400">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-kin-400 text-sumi-950 font-black text-xs rounded-full flex items-center justify-center">
                      {cart.reduce((a, c) => a + c.quantity, 0)}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-kin-300 font-bold uppercase tracking-wider">Giỏ Món Gọi Thêm</p>
                    <p className="text-sm font-black font-mono text-white">
                      {formatVND(cart.reduce((a, c) => a + c.totalPrice, 0))}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-kin-300 bg-sumi-950/70 px-3 py-2 rounded-xl border border-kin-500/30">
                  <span>Xem Giỏ ({cart.length}) & Gửi Bếp</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          )}

          {/* CART DRAWER / MODAL */}
          {isCartOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="w-full sm:max-w-lg bg-sumi-950 border border-kin-500/40 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[85vh] text-washi-100">
                <div className="flex items-center justify-between pb-4 border-b border-sumi-800">
                  <div className="flex items-center gap-2.5">
                    <ShoppingBag className="w-5 h-5 text-kin-400" />
                    <h3 className="font-serif text-lg font-bold text-white">
                      Giỏ Món Gọi Thêm ({cart.reduce((a, c) => a + c.quantity, 0)} món)
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-1.5 rounded-lg text-washi-400 hover:text-white bg-sumi-900 border border-sumi-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto py-3 space-y-3 custom-scrollbar divide-y divide-sumi-800/80">
                  {cart.map((item) => (
                    <div key={item.cartItemId} className="pt-3 first:pt-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white">{item.dish.name}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDishModal(item.dish);
                              }}
                              className="text-[10px] text-kin-300 hover:text-kin-200 underline"
                            >
                              Đổi tùy chọn
                            </button>
                          </div>
                          {item.selectedOptions.length > 0 && (
                            <p className="text-[11px] text-kin-300 mt-0.5 font-medium">
                              + {item.selectedOptions.map((o) => o.optionName).join(', ')}
                            </p>
                          )}
                          {item.specialInstructions && (
                            <p className="text-[11px] text-emerald-400 mt-0.5 italic">
                              📝 Ghi chú: {item.specialInstructions}
                            </p>
                          )}
                          <p className="text-xs font-mono font-bold text-washi-300 mt-1">
                            {formatVND(item.unitPrice)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border border-sumi-700 rounded-lg bg-sumi-900 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQuantity(item.cartItemId, -1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-sumi-800 text-washi-200"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-white font-mono">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQuantity(item.cartItemId, 1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-sumi-800 text-washi-200"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(item.cartItemId)}
                            className="p-1.5 text-washi-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="text-right font-mono font-bold text-xs text-kin-400">
                        {formatVND(item.totalPrice)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer with totals & send order */}
                <div className="pt-4 border-t border-sumi-800 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-washi-300 font-bold uppercase tracking-wider">
                      Tổng tiền món gọi thêm:
                    </span>
                    <span className="text-xl font-black font-mono text-kin-400">
                      {formatVND(cart.reduce((a, c) => a + c.totalPrice, 0))}
                    </span>
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(false)}
                      className="px-4 py-3 rounded-xl text-xs font-bold bg-sumi-900 border border-sumi-700 text-washi-200 hover:text-white transition-all"
                    >
                      Chọn Thêm Món
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOrder}
                      disabled={orderSubmitting || cart.length === 0}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-shu-950/80 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      {orderSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>ĐANG GỬI VÀO BẾP...</span>
                        </>
                      ) : (
                        <>
                          <span>XÁC NHẬN GỬI MÓN XUỐNG BẾP</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CALL BILL CONFIRMATION MODAL */}
          {isBillRequested && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-sumi-900 border border-kin-500/40 rounded-2xl max-w-sm w-full p-6 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-black uppercase text-white">
                    Đã Gửi Yêu Cầu Thanh Toán
                  </h4>
                  <p className="text-xs text-washi-300 mt-1">
                    Nhân viên thu ngân và phục vụ tại {table?.tableNumber || `BÀN #${tableId}`} đã nhận được thông báo và đang mang hóa đơn đến bàn bạn.
                  </p>
                </div>

                <div className="p-3 bg-sumi-950 rounded-xl border border-sumi-800 flex justify-between items-center text-xs">
                  <span className="text-washi-400">Tổng tạm tính:</span>
                  <span className="text-lg font-black font-mono text-kin-300">
                    {formatVND(totalCurrentBill)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBillRequested(false)}
                  className="w-full py-2.5 bg-sumi-800 hover:bg-sumi-700 text-white font-bold text-xs rounded-xl"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
          {/* DISH CUSTOMIZATION MODAL */}
          <DishDetailModal
            dish={selectedDishModal}
            onClose={() => setSelectedDishModal(null)}
            onAddToCart={handleAddToCartModal}
            confirmButtonText="Thêm Vào Giỏ Gọi Món"
          />
        </main>
      )}
    </div>
  );
};
