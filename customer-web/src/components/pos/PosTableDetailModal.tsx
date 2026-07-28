import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Utensils,
  CheckCircle2,
  Clock,
  Plus,
  Minus,
  Trash2,
  ArrowRightLeft,
  GitMerge,
  Split,
  History,
  CreditCard,
  Search,
  AlertCircle,
  FileText,
  Printer,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  PosTable,
  posService,
  TableOrderHistoryItem,
  OrderReceiptDto,
} from '@/services/posService';
import { OrderDetailViewDto } from '@/services/orderService';
import { menuService } from '@/services/menuService';
import { getErrorMessage } from '@/services/apiClient';
import { Dish, Category } from '@/types';
import { formatVND } from '@/utils/dateUtils';
import { useAuth } from '@/context/AuthContext';
import { PosReceiptModal, PosReceiptData } from './PosReceiptModal';

export interface OrderItemDisplay {
  id: number;
  menuItemId: number;
  name: string;
  quantity: number;
  price: number;
  total: number;
  status: 'Pending' | 'SentToKitchen' | 'Cooking' | 'Ready' | 'Served' | 'Cancelled' | string;
  modifiersSummary?: string;
  specialInstructions?: string;
}

export interface PendingAddItem {
  uid: string;
  dishId: number;
  dish: Dish;
  name: string;
  japaneseName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedOptionIds: number[];
  optionsSummary?: string;
  specialInstructions?: string;
}

interface PosTableDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: PosTable | null;
  allTables: PosTable[];
  onOpenCheckout: () => void;
  onRefreshTables: () => void;
}

function mapReceiptDtoToModal(dto: OrderReceiptDto, isReprint = false): PosReceiptData {
  return {
    orderNumber: dto.orderNumber,
    tableName: dto.tableName,
    cashierName: dto.cashierName || 'Thu ngân',
    createdAt: dto.createdAt ? new Date(dto.createdAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'),
    completedAt: dto.completedAt ? new Date(dto.completedAt).toLocaleString('vi-VN') : null,
    customerName: dto.customerName || undefined,
    customerPhone: dto.customerPhone || undefined,
    membershipTier: dto.membershipTier || undefined,
    items: (dto.items || []).map((it) => ({
      name: it.itemName || it.name || 'Món ăn',
      quantity: it.quantity,
      price: Number(it.unitPrice ?? it.price ?? 0),
      total: Number(it.totalPrice ?? it.total ?? 0),
      modifiers: it.modifiersSummary || it.modifiers || undefined,
    })),
    subtotal: Number(dto.subTotal ?? 0),
    voucherCode: dto.voucherCode || undefined,
    discountAmount: Number(dto.discountAmount ?? 0),
    taxAmount: Number(dto.taxAmount ?? 0),
    totalAmount: Number(dto.totalAmount ?? 0),
    paidAmount: Number(dto.paidAmount ?? 0),
    remainingAmount: Number(dto.remainingAmount ?? 0),
    paymentMethod: dto.paymentMethod || 'CASH',
    amountGiven: dto.amountGiven ?? undefined,
    changeAmount: dto.changeAmount ?? undefined,
    isReprint,
  };
}

export const PosTableDetailModal: React.FC<PosTableDetailModalProps> = ({
  isOpen,
  onClose,
  table,
  allTables,
  onOpenCheckout,
  onRefreshTables,
}) => {
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'ITEMS' | 'ADD_FOOD' | 'TRANSFER' | 'HISTORY'>('ITEMS');
  const [orderDetail, setOrderDetail] = useState<OrderDetailViewDto | null>(null);
  const [items, setItems] = useState<OrderItemDisplay[]>([]);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Menu items for ADD_FOOD
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [specialNote, setSpecialNote] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [pendingAddItems, setPendingAddItems] = useState<PendingAddItem[]>([]);

  // Transfer / Merge / Split state
  const [transferTargetId, setTransferTargetId] = useState<number | ''>('');
  const [mergeTargetId, setMergeTargetId] = useState<number | ''>('');
  const [selectedItemIdsToSplit, setSelectedItemIdsToSplit] = useState<number[]>([]);
  const [splitTargetId, setSplitTargetId] = useState<number | ''>('');
  const [isProcessingTableAction, setIsProcessingTableAction] = useState(false);

  // Cancel item modal
  const [cancellingItem, setCancellingItem] = useState<OrderItemDisplay | null>(null);
  const [cancelReason, setCancelReason] = useState('Khách đổi món khác');
  const [isCancelling, setIsCancelling] = useState(false);

  // History & Reprint state
  const [tableHistory, setTableHistory] = useState<TableOrderHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [reprintLoadingOrderId, setReprintLoadingOrderId] = useState<number | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<PosReceiptData | null>(null);

  const activeOrderId = table?.currentOrderId ?? table?.activeOrderId ?? null;

  const loadOrderDetail = useCallback(async () => {
    if (!activeOrderId) {
      setOrderDetail(null);
      setItems([]);
      return;
    }
    setIsLoadingOrder(true);
    setActionError(null);
    try {
      const detail = await posService.getOrder(activeOrderId);
      setOrderDetail(detail);
      const mapped: OrderItemDisplay[] = (detail.items || []).map((it) => ({
        id: it.orderItemId,
        menuItemId: it.menuItemId,
        name: it.itemName,
        quantity: it.quantity,
        price: Number(it.unitPrice ?? 0),
        total: Number(it.totalPrice ?? 0),
        status: it.itemStatus || 'Pending',
        modifiersSummary: (it.modifiers || []).map((m) => m.modifierOptionName).filter(Boolean).join(', '),
        specialInstructions: it.specialInstructions || undefined,
      }));
      setItems(mapped);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsLoadingOrder(false);
    }
  }, [activeOrderId]);

  const loadTableHistory = useCallback(async () => {
    if (!table?.tableId) return;
    setIsLoadingHistory(true);
    try {
      const list = await posService.getTableOrderHistory(table.tableId, 20);
      setTableHistory(list);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [table?.tableId]);

  useEffect(() => {
    if (!isOpen) return;
    menuService.getCategories().then((cats) => setCategories(cats)).catch(() => {});
    menuService.getDishes({ pageSize: 200 }).then((res) => setDishes(res.items)).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && table) {
      setActiveTab('ITEMS');
      setActionError(null);
      setActionSuccess(null);
      setSelectedDish(null);
      setSelectedOptionIds([]);
      setPendingAddItems([]);
      setSelectedItemIdsToSplit([]);
      setTransferTargetId('');
      setMergeTargetId('');
      setSplitTargetId('');
      void loadOrderDetail();
      void loadTableHistory();
    }
  }, [isOpen, table, loadOrderDetail, loadTableHistory]);

  if (!isOpen || !table) return null;

  const activeItems = items.filter((it) => it.status !== 'Cancelled');
  const pendingOrCookingItems = activeItems.filter((it) => it.status !== 'Served' && it.status !== 'Ready');
  const completedItems = activeItems.filter((it) => it.status === 'Ready' || it.status === 'Served');
  const cancelledItems = items.filter((it) => it.status === 'Cancelled');

  const subtotal = orderDetail?.subTotal ?? activeItems.reduce((acc, curr) => acc + curr.total, 0);

  const handleSelectDish = (dish: Dish) => {
    setSelectedDish(dish);
    const defaults: number[] = [];
    (dish.optionGroups || []).forEach((g) => {
      const def = g.options.find((o) => o.isDefault);
      if (def) defaults.push(def.id);
      else if (g.isRequired && g.options[0]) defaults.push(g.options[0].id);
    });
    setSelectedOptionIds(defaults);
    setQuantityToAdd(1);
    setSpecialNote('');
  };

  const handleToggleModifierOption = (groupId: number, optionId: number, maxSel: number) => {
    const group = selectedDish?.optionGroups?.find((g) => g.id === groupId);
    if (!group) return;
    const groupOptionIds = group.options.map((o) => o.id);
    setSelectedOptionIds((prev) => {
      const others = prev.filter((id) => !groupOptionIds.includes(id));
      const inGroup = prev.filter((id) => groupOptionIds.includes(id));
      if (maxSel === 1) {
        return [...others, optionId];
      }
      if (inGroup.includes(optionId)) {
        return [...others, ...inGroup.filter((id) => id !== optionId)];
      }
      if (inGroup.length >= maxSel) {
        return [...others, ...inGroup.slice(1), optionId];
      }
      return [...others, ...inGroup, optionId];
    });
  };

  const handleConfirmCancelItem = async () => {
    if (!cancellingItem || !activeOrderId) return;
    setIsCancelling(true);
    setActionError(null);
    try {
      await posService.cancelOrderItem({
        orderId: activeOrderId,
        orderItemId: cancellingItem.id,
        reason: cancelReason,
      });
      setCancellingItem(null);
      setActionSuccess(`Đã hủy món "${cancellingItem.name}" và đồng bộ xuống bếp.`);
      await loadOrderDetail();
      onRefreshTables();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  };

  const totalPendingQuantity = pendingAddItems.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalPendingAmount = pendingAddItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

  const getDishPendingCount = (dishId: number) => {
    return pendingAddItems
      .filter((it) => it.dishId === dishId)
      .reduce((acc, curr) => acc + curr.quantity, 0);
  };

  const handleQuickAddDish = (dish: Dish) => {
    const hasRequiredOptions = (dish.optionGroups || []).some((g) => g.isRequired);
    if (hasRequiredOptions) {
      handleSelectDish(dish);
      return;
    }

    setPendingAddItems((prev) => {
      const existingIndex = prev.findIndex(
        (it) => it.dishId === dish.id && it.selectedOptionIds.length === 0 && !it.specialInstructions
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const item = updated[existingIndex];
        const newQty = item.quantity + 1;
        updated[existingIndex] = {
          ...item,
          quantity: newQty,
          totalPrice: item.unitPrice * newQty,
        };
        return updated;
      }

      const newItem: PendingAddItem = {
        uid: `${dish.id}_plain_${Date.now()}_${Math.random()}`,
        dishId: dish.id,
        dish,
        name: dish.name,
        japaneseName: dish.japaneseName,
        quantity: 1,
        unitPrice: dish.price,
        totalPrice: dish.price,
        selectedOptionIds: [],
        optionsSummary: undefined,
        specialInstructions: undefined,
      };
      return [...prev, newItem];
    });
  };

  const handleDecrementDish = (dishId: number) => {
    setPendingAddItems((prev) => {
      const lastIndex = [...prev].reverse().findIndex((it) => it.dishId === dishId);
      if (lastIndex === -1) return prev;
      const actualIndex = prev.length - 1 - lastIndex;
      const item = prev[actualIndex];
      if (item.quantity > 1) {
        const updated = [...prev];
        const newQty = item.quantity - 1;
        updated[actualIndex] = {
          ...item,
          quantity: newQty,
          totalPrice: item.unitPrice * newQty,
        };
        return updated;
      } else {
        return prev.filter((_, idx) => idx !== actualIndex);
      }
    });
  };

  const handleUpdatePendingQuantity = (uid: string, delta: number) => {
    setPendingAddItems((prev) =>
      prev
        .map((item) => {
          if (item.uid !== uid) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...item,
            quantity: newQty,
            totalPrice: item.unitPrice * newQty,
          };
        })
        .filter((it): it is PendingAddItem => it !== null)
    );
  };

  const handleRemovePendingItem = (uid: string) => {
    setPendingAddItems((prev) => prev.filter((it) => it.uid !== uid));
  };

  const handleClearPendingItems = () => {
    setPendingAddItems([]);
  };

  const handleAddCustomizedDishToPending = () => {
    if (!selectedDish) return;

    const extraPrice = (selectedDish.optionGroups || [])
      .flatMap((g) => g.options)
      .filter((o) => selectedOptionIds.includes(o.id))
      .reduce((sum, o) => sum + (o.priceAdjustment || 0), 0);

    const calculatedUnitPrice = selectedDish.price + extraPrice;

    const selectedOptionsList = (selectedDish.optionGroups || [])
      .flatMap((g) => g.options)
      .filter((o) => selectedOptionIds.includes(o.id));

    const optionsSummary =
      selectedOptionsList.length > 0 ? selectedOptionsList.map((o) => o.name).join(', ') : undefined;

    const newItem: PendingAddItem = {
      uid: `${selectedDish.id}_opt_${Date.now()}_${Math.random()}`,
      dishId: selectedDish.id,
      dish: selectedDish,
      name: selectedDish.name,
      japaneseName: selectedDish.japaneseName,
      quantity: quantityToAdd,
      unitPrice: calculatedUnitPrice,
      totalPrice: calculatedUnitPrice * quantityToAdd,
      selectedOptionIds: [...selectedOptionIds],
      optionsSummary,
      specialInstructions: specialNote.trim() || undefined,
    };

    setPendingAddItems((prev) => [...prev, newItem]);
    setSelectedDish(null);
    setSelectedOptionIds([]);
    setQuantityToAdd(1);
    setSpecialNote('');
  };

  const handleBatchSendToKitchen = async () => {
    if (pendingAddItems.length === 0 || !activeOrderId) return;
    setIsAddingItem(true);
    setActionError(null);
    try {
      const itemsPayload = pendingAddItems.map((item) => ({
        menuItemId: item.dishId,
        quantity: item.quantity,
        modifierOptionIds: item.selectedOptionIds.length > 0 ? item.selectedOptionIds : undefined,
        specialInstructions: item.specialInstructions || undefined,
      }));

      await posService.addItemsToOrder({
        orderId: activeOrderId,
        items: itemsPayload,
        sendDirectlyToKitchen: true,
      });

      const totalPortions = pendingAddItems.reduce((acc, curr) => acc + curr.quantity, 0);
      setActionSuccess(
        `Đã thêm thành công ${pendingAddItems.length} món (${totalPortions} phần) vào bàn và gửi xuống bếp KDS.`
      );
      setPendingAddItems([]);
      setActiveTab('ITEMS');
      await loadOrderDetail();
      onRefreshTables();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleAddDishToOrder = async () => {
    if (!selectedDish || !activeOrderId) return;
    handleAddCustomizedDishToPending();
  };

  const handleTransferTable = async () => {
    if (!transferTargetId) return;
    setIsProcessingTableAction(true);
    setActionError(null);
    try {
      await posService.transferTable(table.tableId, Number(transferTargetId));
      onRefreshTables();
      onClose();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsProcessingTableAction(false);
    }
  };

  const handleMergeTable = async () => {
    if (!mergeTargetId) return;
    setIsProcessingTableAction(true);
    setActionError(null);
    try {
      await posService.mergeTables(table.tableId, Number(mergeTargetId));
      setActionSuccess('Đã gộp bàn thành công!');
      await loadOrderDetail();
      onRefreshTables();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsProcessingTableAction(false);
    }
  };

  const handleSplitTable = async () => {
    if (!splitTargetId || selectedItemIdsToSplit.length === 0 || !activeOrderId) {
      setActionError('Vui lòng chọn bàn đích và ít nhất 1 món cần tách.');
      return;
    }
    setIsProcessingTableAction(true);
    setActionError(null);
    try {
      await posService.splitOrder({
        sourceOrderId: activeOrderId,
        targetTableId: Number(splitTargetId),
        orderItemIds: selectedItemIdsToSplit,
      });
      setSelectedItemIdsToSplit([]);
      setSplitTargetId('');
      setActionSuccess(`Đã tách ${selectedItemIdsToSplit.length} món sang bàn mới thành công!`);
      await loadOrderDetail();
      onRefreshTables();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsProcessingTableAction(false);
    }
  };

  const handleReprintHistoryOrder = async (historyOrder: TableOrderHistoryItem) => {
    const orderId = historyOrder.orderId ?? historyOrder.id;
    if (!orderId) return;
    setReprintLoadingOrderId(orderId);
    setActionError(null);
    try {
      const dto = await posService.getOrderReceipt(orderId);
      setReceiptPreview(mapReceiptDtoToModal(dto, true));
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setReprintLoadingOrderId(null);
    }
  };

  const handleOpenProvisionalReceipt = () => {
    setReceiptPreview({
      orderNumber: orderDetail?.orderNumber || `TEMP-${table.tableNumber}`,
      tableName: table.tableNumber,
      cashierName: currentUser?.fullName || 'Thu ngân',
      createdAt: table.openedAt
        ? new Date(table.openedAt).toLocaleString('vi-VN')
        : new Date().toLocaleString('vi-VN'),
      items: activeItems.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        total: it.total,
        modifiers: it.modifiersSummary,
      })),
      subtotal,
      voucherCode: orderDetail?.voucherCode,
      discountAmount: orderDetail?.discountAmount || 0,
      taxAmount: orderDetail?.taxAmount || 0,
      totalAmount: orderDetail?.totalAmount ?? subtotal,
      paymentMethod: 'CASH',
      isProvisional: true,
    });
  };

  const filteredDishes = dishes.filter((dish) => {
    const matchCat = selectedCategory === 'all' || dish.categoryId === selectedCategory;
    const matchSearch =
      !searchQuery.trim() ||
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dish.japaneseName && dish.japaneseName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Served':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            Đã Phục Vụ
          </span>
        );
      case 'Ready':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            Bếp Đã Xong
          </span>
        );
      case 'Cooking':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-amber-50 text-amber-700 border border-amber-200">
            Đang Chế Biến
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-700 border border-slate-200">
            Chờ Bếp
          </span>
        );
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
        <div className="relative w-full max-w-5xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
          {/* Top Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                <Utensils className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-extrabold text-slate-950">{table.tableNumber}</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white">
                    Đang Phục Vụ
                  </span>
                  <span className="text-xs text-slate-500">
                    ({table.areaName} • {orderDetail?.guestCount || table.guestCount || 2} Khách)
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Giờ mở bàn:{' '}
                    {table.openedAt
                      ? new Date(table.openedAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '--:--'}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-700 font-bold">
                    Tạm tính: {formatVND(orderDetail?.totalAmount ?? subtotal)}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void loadOrderDetail()}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                title="Làm mới chi tiết bàn"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingOrder ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onOpenCheckout}
                className="py-2 px-4 rounded-xl font-bold text-xs text-white bg-red-600 hover:bg-red-700 shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span>Thanh Toán ({formatVND(orderDetail?.totalAmount ?? subtotal)})</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng chi tiết bàn"
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 px-6 bg-slate-50 border-b border-slate-200 text-xs overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('ITEMS')}
              className={`py-3 px-4 font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'ITEMS'
                  ? 'border-emerald-600 text-emerald-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Danh Sách Món Ăn ({activeItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ADD_FOOD')}
              className={`py-3 px-4 font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'ADD_FOOD'
                  ? 'border-emerald-600 text-emerald-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Gọi Thêm Món Vào Bàn</span>
              {totalPendingQuantity > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black animate-pulse">
                  {totalPendingQuantity} món chờ
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('TRANSFER')}
              className={`py-3 px-4 font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'TRANSFER'
                  ? 'border-emerald-600 text-emerald-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Chuyển / Gộp / Tách Bàn</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('HISTORY');
                void loadTableHistory();
              }}
              className={`py-3 px-4 font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'HISTORY'
                  ? 'border-emerald-600 text-emerald-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Lịch Sử Order Bàn ({tableHistory.length})</span>
            </button>
          </div>

          {/* Inline feedback banners */}
          {(actionError || actionSuccess) && (
            <div className="px-6 pt-3 space-y-2 shrink-0">
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                  <button type="button" onClick={() => setActionError(null)} className="text-red-500 hover:text-red-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {actionSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{actionSuccess}</span>
                  </div>
                  <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-900">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {/* TAB 1: ITEMS */}
            {activeTab === 'ITEMS' && (
              <div className="space-y-5">
                {/* Món đang xử lý tại bếp */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Clock className="w-4 h-4" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider">
                        Món Đang Chế Biến Tại Bếp ({pendingOrCookingItems.length})
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-500 italic">
                      Bếp KDS tự động hoàn thành món khi chế biến xong
                    </span>
                  </div>

                  {isLoadingOrder && activeItems.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">Đang tải danh sách món...</p>
                  ) : pendingOrCookingItems.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center italic">
                      Không còn món nào đang chờ bếp.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {pendingOrCookingItems.map((item) => (
                        <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-900">{item.name}</span>
                              <span className="text-xs font-black px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                x{item.quantity}
                              </span>
                              {renderStatusBadge(item.status)}
                            </div>
                            {item.modifiersSummary && (
                              <p className="text-[11px] text-slate-600 italic mt-0.5">
                                + {item.modifiersSummary}
                              </p>
                            )}
                            {item.specialInstructions && (
                              <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                                Ghi chú: {item.specialInstructions}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Đơn giá: {formatVND(item.price)} • Thành tiền: {formatVND(item.total)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setCancellingItem(item)}
                            className="p-2 rounded-lg text-xs font-semibold bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-colors shrink-0"
                            title="Hủy món"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Món bếp đã hoàn thành */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider">
                        Món Bếp Đã Hoàn Thành ({completedItems.length})
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      Tổng: {formatVND(completedItems.reduce((acc, c) => acc + c.total, 0))}
                    </span>
                  </div>

                  {completedItems.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center italic">
                      Chưa có món nào hoàn thành từ bếp.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {completedItems.map((item) => (
                        <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                              <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                                x{item.quantity}
                              </span>
                              {renderStatusBadge(item.status)}
                            </div>
                            {item.modifiersSummary && (
                              <p className="text-[11px] text-slate-500 italic mt-0.5">
                                + {item.modifiersSummary}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {formatVND(item.price)} x {item.quantity} = {formatVND(item.total)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {cancelledItems.length > 0 && (
                  <div className="bg-red-50/60 rounded-xl border border-red-200 p-3 text-xs text-red-800">
                    <p className="font-bold mb-1 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Món đã hủy ({cancelledItems.length}):</span>
                    </p>
                    <div className="space-y-1 pl-5">
                      {cancelledItems.map((c) => (
                        <div key={c.id}>
                          {c.name} x{c.quantity} • {formatVND(c.total)} (Đã hủy)
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ADD FOOD */}
            {activeTab === 'ADD_FOOD' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                        selectedCategory === 'all'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Tất Cả
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCategory(c.id)}
                        className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                          selectedCategory === c.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[220px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm món nhanh..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* QUICK BAR FOR PENDING ITEMS */}
                {pendingAddItems.length > 0 && (
                  <div className="bg-emerald-800 text-white p-3 rounded-xl shadow-lg flex items-center justify-between gap-3 border border-emerald-600 animate-fade-in">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-emerald-700 border border-emerald-500 flex items-center justify-center font-black text-sm text-amber-300">
                        {totalPendingQuantity}
                      </span>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider">
                          Đã chọn {pendingAddItems.length} món ({totalPendingQuantity} phần) • {formatVND(totalPendingAmount)}
                        </p>
                        <p className="text-[11px] text-emerald-200">
                          Bấm nút bên phải hoặc nút ở chân trang để xác nhận gửi bếp KDS
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleClearPendingItems}
                        className="px-3 py-1.5 bg-emerald-900 hover:bg-red-900/60 text-xs font-semibold rounded-lg transition-colors"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={isAddingItem || !activeOrderId}
                        onClick={handleBatchSendToKitchen}
                        className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg shadow-md flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        {isAddingItem ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang gửi...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Xác Nhận Thêm Món Vào Bàn</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* DISH GRID */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  {filteredDishes.map((dish) => {
                    const pendingCount = getDishPendingCount(dish.id);
                    const hasModifiers = (dish.optionGroups || []).length > 0;
                    const isSelected = pendingCount > 0;

                    return (
                      <div
                        key={dish.id}
                        className={`text-left bg-white border rounded-xl p-3 transition-all flex flex-col justify-between group shadow-xs ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div onClick={() => handleQuickAddDish(dish)} className="cursor-pointer">
                          {dish.imageUrl && (
                            <div className="h-24 w-full rounded-lg overflow-hidden mb-2 bg-slate-100 relative">
                              <img
                                src={dish.imageUrl}
                                alt={dish.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              {isSelected && (
                                <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[11px] shadow-sm">
                                  x{pendingCount}
                                </span>
                              )}
                            </div>
                          )}
                          <div>
                            <h5 className="font-bold text-xs text-slate-900 line-clamp-2">{dish.name}</h5>
                            {dish.japaneseName && (
                              <p className="text-[10px] text-slate-500 line-clamp-1">{dish.japaneseName}</p>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between w-full gap-1">
                          <span className="font-bold text-xs text-emerald-700">{formatVND(dish.price)}</span>

                          <div className="flex items-center gap-1">
                            {hasModifiers && (
                              <button
                                type="button"
                                onClick={() => handleSelectDish(dish)}
                                title="Tùy chọn topping & ghi chú"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {isSelected ? (
                              <div className="flex items-center border border-emerald-600 rounded-lg overflow-hidden bg-white shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleDecrementDish(dish.id)}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-xs"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="px-2 font-bold text-xs text-emerald-800">{pendingCount}</span>
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddDish(dish)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuickAddDish(dish)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors flex items-center gap-1 font-bold text-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* PENDING ITEMS DRAFT CART TRAY */}
                {pendingAddItems.length > 0 && (
                  <div className="bg-emerald-950/5 border-2 border-emerald-500/40 rounded-2xl p-4 shadow-md space-y-3 animate-fade-in mt-4">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                      <div className="flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-emerald-700" />
                        <h4 className="text-xs font-black uppercase text-emerald-950 tracking-wider">
                          Danh Sách Món Chuẩn Bị Gửi Bếp ({pendingAddItems.length} món • {totalPendingQuantity} phần)
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearPendingItems}
                        className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa danh sách chờ</span>
                      </button>
                    </div>

                    <div className="max-h-44 overflow-y-auto divide-y divide-emerald-100 pr-1 space-y-1">
                      {pendingAddItems.map((item) => (
                        <div key={item.uid} className="pt-2 first:pt-0 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 truncate">{item.name}</span>
                              <span className="font-mono text-xs text-emerald-700 font-bold">
                                {formatVND(item.unitPrice)}
                              </span>
                            </div>
                            {item.optionsSummary && (
                              <p className="text-[11px] text-slate-500 italic truncate">+ {item.optionsSummary}</p>
                            )}
                            {item.specialInstructions && (
                              <p className="text-[11px] text-amber-700 font-semibold truncate">
                                Ghi chú: {item.specialInstructions}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleUpdatePendingQuantity(item.uid, -1)}
                                className="px-2 py-0.5 bg-slate-50 hover:bg-slate-200 text-slate-800 font-bold text-xs"
                              >
                                -
                              </button>
                              <span className="px-2.5 py-0.5 font-bold text-xs min-w-[24px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdatePendingQuantity(item.uid, 1)}
                                className="px-2 py-0.5 bg-slate-50 hover:bg-slate-200 text-slate-800 font-bold text-xs"
                              >
                                +
                              </button>
                            </div>

                            <span className="font-mono font-bold text-xs text-slate-900 min-w-[70px] text-right">
                              {formatVND(item.totalPrice)}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleRemovePendingItem(item.uid)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                              title="Xóa món này"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-emerald-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="text-left">
                        <span className="text-[11px] text-slate-600 block uppercase font-bold">Tổng tiền gọi thêm:</span>
                        <span className="text-base font-black font-mono text-emerald-800">
                          {formatVND(totalPendingAmount)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleBatchSendToKitchen}
                        disabled={isAddingItem || !activeOrderId}
                        className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        {isAddingItem ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>ĐANG GỬI XUỐNG BẾP ({totalPendingQuantity} PHẦN)...</span>
                          </>
                        ) : (
                          <>
                            <Utensils className="w-4 h-4" />
                            <span>XÁC NHẬN GỌI {totalPendingQuantity} MÓN & BẮN XUỐNG BẾP KDS</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* CUSTOMIZATION MODAL FOR SPECIFIC DISH */}
                {selectedDish && (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                      <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                        <div>
                          <h4 className="text-base font-bold text-slate-950">{selectedDish.name}</h4>
                          {selectedDish.japaneseName && (
                            <p className="text-xs text-slate-500">{selectedDish.japaneseName}</p>
                          )}
                          <p className="text-sm font-bold text-emerald-700 mt-1">
                            Đơn giá: {formatVND(selectedDish.price)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedDish(null)}
                          className="p-1 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {selectedDish.optionGroups && selectedDish.optionGroups.length > 0 && (
                        <div className="space-y-3 pt-1">
                          {selectedDish.optionGroups.map((group) => (
                            <div key={group.id} className="space-y-1.5">
                              <p className="text-xs font-bold text-slate-800">
                                {group.name} {group.isRequired ? '(Bắt buộc)' : '(Tùy chọn)'}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {group.options.map((opt) => {
                                  const selected = selectedOptionIds.includes(opt.id);
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() =>
                                        handleToggleModifierOption(group.id, opt.id, group.maxSelection || 1)
                                      }
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                        selected
                                          ? 'bg-emerald-600 text-white border-emerald-600'
                                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      {opt.name}
                                      {opt.priceAdjustment > 0 ? ` (+${formatVND(opt.priceAdjustment)})` : ''}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold uppercase text-slate-700">Số lượng:</span>
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setQuantityToAdd((q) => Math.max(1, q - 1))}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold"
                          >
                            -
                          </button>
                          <span className="px-4 py-1 font-bold text-xs bg-white">{quantityToAdd}</span>
                          <button
                            type="button"
                            onClick={() => setQuantityToAdd((q) => q + 1)}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase text-slate-700 block mb-1">
                          Ghi Chú Cho Đầu Bếp:
                        </label>
                        <input
                          type="text"
                          placeholder="VD: Không hành, làm cay nhiều, đem đĩa nóng..."
                          value={specialNote}
                          onChange={(e) => setSpecialNote(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleAddCustomizedDishToPending}
                          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white rounded-xl shadow-sm flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Thêm {quantityToAdd} Phần Vào Danh Sách Chờ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDish(null)}
                          className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl"
                        >
                          Đóng
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TRANSFER / MERGE / SPLIT */}
            {activeTab === 'TRANSFER' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. CHUYỂN BÀN */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between shadow-xs">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 mb-2">
                      <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                      <span>Chuyển Toàn Bộ Bàn</span>
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Chuyển toàn bộ danh sách món và khách của {table.tableNumber} sang một bàn trống khác.
                    </p>
                    <div className="mt-3">
                      <label className="text-[11px] text-slate-700 block mb-1 font-semibold">
                        Chọn bàn đích trống:
                      </label>
                      <select
                        value={transferTargetId}
                        onChange={(e) => setTransferTargetId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                      >
                        <option value="">-- Chọn bàn trống --</option>
                        {allTables
                          .filter((t) => t.tableId !== table.tableId && t.status === 'Empty')
                          .map((t) => (
                            <option key={t.tableId} value={t.tableId}>
                              {t.tableNumber} ({t.areaName} - {t.capacity} người)
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTransferTable}
                    disabled={!transferTargetId || isProcessingTableAction}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl disabled:opacity-40 transition-colors"
                  >
                    Xác Nhận Chuyển Bàn
                  </button>
                </div>

                {/* 2. GỘP BÀN */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between shadow-xs">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 mb-2">
                      <GitMerge className="w-4 h-4 text-emerald-600" />
                      <span>Gộp Bàn Phụ</span>
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Gộp thêm bàn khác vào {table.tableNumber} để phục vụ chung một nhóm khách.
                    </p>
                    <div className="mt-3">
                      <label className="text-[11px] text-slate-700 block mb-1 font-semibold">
                        Chọn bàn cần gộp:
                      </label>
                      <select
                        value={mergeTargetId}
                        onChange={(e) => setMergeTargetId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                      >
                        <option value="">-- Chọn bàn --</option>
                        {allTables
                          .filter((t) => t.tableId !== table.tableId && (t.status === 'Empty' || t.status === 'Serving'))
                          .map((t) => (
                            <option key={t.tableId} value={t.tableId}>
                              {t.tableNumber} ({t.areaName} • {t.status})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleMergeTable}
                    disabled={!mergeTargetId || isProcessingTableAction}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl disabled:opacity-40 transition-colors"
                  >
                    Xác Nhận Gộp Bàn
                  </button>
                </div>

                {/* 3. TÁCH BÀN */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between shadow-xs">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 mb-2">
                      <Split className="w-4 h-4 text-emerald-600" />
                      <span>Tách Món Sang Bàn Mới</span>
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Chọn các món cần tách sang một bàn trống mới:
                    </p>
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2 bg-slate-50">
                      {activeItems.map((it) => (
                        <label key={it.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedItemIdsToSplit.includes(it.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedItemIdsToSplit((prev) => [...prev, it.id]);
                              else setSelectedItemIdsToSplit((prev) => prev.filter((id) => id !== it.id));
                            }}
                            className="rounded border-slate-300 text-emerald-600"
                          />
                          <span className="truncate text-slate-800">
                            {it.name} (x{it.quantity})
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-2">
                      <select
                        value={splitTargetId}
                        onChange={(e) => setSplitTargetId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                      >
                        <option value="">-- Bàn trống chuyển sang --</option>
                        {allTables
                          .filter((t) => t.tableId !== table.tableId && t.status === 'Empty')
                          .map((t) => (
                            <option key={t.tableId} value={t.tableId}>
                              {t.tableNumber} ({t.areaName})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSplitTable}
                    disabled={!splitTargetId || selectedItemIdsToSplit.length === 0 || isProcessingTableAction}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl disabled:opacity-40 transition-colors"
                  >
                    Xác Nhận Tách Bàn
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: TABLE HISTORY */}
            {activeTab === 'HISTORY' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Lịch Sử Hóa Đơn Đã Thanh Toán Của {table.tableNumber}
                  </h4>
                  <button
                    type="button"
                    onClick={() => void loadTableHistory()}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    <span>Tải lại</span>
                  </button>
                </div>

                {isLoadingHistory ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                    Đang tải lịch sử hóa đơn từ SQL Server...
                  </div>
                ) : tableHistory.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                    Bàn {table.tableNumber} chưa có lịch sử hóa đơn nào đã hoàn tất.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    {tableHistory.map((h) => {
                      const oid = h.orderId ?? h.id ?? 0;
                      return (
                        <div
                          key={oid || h.orderNumber}
                          className="p-4 flex flex-wrap justify-between items-center text-xs gap-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-950 font-mono">
                                {h.orderNumber}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                {h.paymentMethod || 'Đã thanh toán'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Hoàn tất:{' '}
                              {h.completedAt
                                ? new Date(h.completedAt).toLocaleString('vi-VN')
                                : h.createdAt
                                ? new Date(h.createdAt).toLocaleString('vi-VN')
                                : '—'}{' '}
                              • Thu ngân: {h.cashierName || 'Nhân viên POS'}
                              {h.customerName ? ` • Khách: ${h.customerName}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="font-extrabold text-sm text-emerald-700 font-mono">
                                {formatVND(h.totalAmount)}
                              </span>
                              {h.items && h.items.length > 0 && (
                                <span className="block text-[10px] text-slate-500">
                                  {h.items.length} món
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => void handleReprintHistoryOrder(h)}
                              disabled={reprintLoadingOrderId === oid}
                              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>
                                {reprintLoadingOrderId === oid ? 'Đang tải...' : 'In lại hóa đơn'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          {activeTab === 'ADD_FOOD' ? (
            <div className="px-6 py-4 bg-emerald-50/80 border-t border-emerald-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-emerald-800 uppercase font-black tracking-wider block">
                    Món Gọi Thêm Vào Bàn:
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-emerald-900 font-mono">
                      {formatVND(totalPendingAmount)}
                    </span>
                    <span className="text-xs font-bold text-emerald-700">
                      ({totalPendingQuantity} món đang chờ gửi)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {pendingAddItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearPendingItems}
                    className="py-2.5 px-4 bg-white hover:bg-red-50 hover:text-red-600 text-slate-700 border border-slate-300 font-semibold text-xs rounded-xl transition-colors"
                  >
                    Xóa chọn ({totalPendingQuantity})
                  </button>
                )}
                <button
                  type="button"
                  disabled={pendingAddItems.length === 0 || isAddingItem || !activeOrderId}
                  onClick={handleBatchSendToKitchen}
                  className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95"
                >
                  {isAddingItem ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang Gửi Bếp...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Xác Nhận Thêm Món Vào Bàn &amp; Gửi Bếp ({totalPendingQuantity})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 uppercase font-bold">Tổng Tạm Tính:</span>
                <span className="text-xl font-black text-emerald-700 font-mono">
                  {formatVND(orderDetail?.totalAmount ?? subtotal)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenProvisionalReceipt}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>In Phiếu Tạm Tính</span>
                </button>
                {orderDetail?.status === 'Completed' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await posService.completeCleaning(table.tableId);
                        onRefreshTables();
                        onClose();
                      } catch (e: any) {
                        alert(e?.message || 'Lỗi khi hoàn tất bàn');
                      }
                    }}
                    className="py-2.5 px-5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ĐÃ THANH TOÁN - HOÀN TẤT &amp; GIẢI PHÓNG BÀN</span>
                  </button>
                ) : (
                  <>
                    {/* NÚT DỌN BÀN CHỈ HIỆN KHI HÓA ĐƠN CỦA BÀN LÀ 0đ */}
                    {Number(orderDetail?.totalAmount ?? subtotal ?? 0) === 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Hóa đơn 0đ. Xác nhận hoàn tất và giải phóng bàn ${table.tableNumber}?`)) {
                            try {
                              await posService.completeCleaning(table.tableId);
                              onRefreshTables();
                              onClose();
                            } catch (e: any) {
                              alert(e?.message || 'Lỗi khi dọn bàn');
                            }
                          }
                        }}
                        className="py-2.5 px-3 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-700 border border-slate-300 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                        title="Bàn 0đ - Giải phóng bàn về trạng thái trống"
                      >
                        <CheckCircle2 className="w-4 h-4 text-sky-600" />
                        <span>Hoàn Tất Dọn Bàn (0đ)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onOpenCheckout}
                      className="py-2.5 px-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Thanh Toán Ngay</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Cancel Item Reason Modal */}
          {cancellingItem && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60">
              <div className="bg-white border border-slate-200 p-5 rounded-2xl max-w-sm w-full space-y-3 shadow-2xl">
                <h4 className="text-sm font-bold text-red-700 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" />
                  <span>Xác Nhận Hủy Món Ăn</span>
                </h4>
                <p className="text-xs text-slate-700">
                  Bạn đang yêu cầu hủy món:{' '}
                  <span className="font-bold text-slate-950">{cancellingItem.name}</span>
                </p>
                <div>
                  <label className="text-[11px] text-slate-600 font-semibold block mb-1">
                    Lý do hủy:
                  </label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                  >
                    <option value="Khách đổi món khác">Khách đổi món khác</option>
                    <option value="Khách chờ lâu quá hủy">Khách chờ lâu quá hủy</option>
                    <option value="Nhân viên nhập nhầm món">Nhân viên nhập nhầm món</option>
                    <option value="Bếp báo hết nguyên liệu">Bếp báo hết nguyên liệu</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => void handleConfirmCancelItem()}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg"
                  >
                    {isCancelling ? 'Đang hủy...' : 'Xác Nhận Hủy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancellingItem(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
                  >
                    Quay Lại
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Receipt / Reprint / Provisional Preview Modal (80mm Portal) */}
      <PosReceiptModal
        isOpen={Boolean(receiptPreview)}
        onClose={() => setReceiptPreview(null)}
        receipt={receiptPreview}
      />
    </>
  );
};
