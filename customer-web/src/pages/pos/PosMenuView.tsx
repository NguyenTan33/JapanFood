import React, { useState, useEffect, useCallback } from 'react';
import {
  Utensils,
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Upload,
} from 'lucide-react';
import {
  menuService,
  InventoryItemDto,
  UnitOfMeasureDto,
} from '@/services/menuService';
import { Dish, Category, normalizeUserRole } from '@/types';
import { formatVND } from '@/utils/dateUtils';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/services/apiClient';

type ActiveTab = 'DISHES' | 'CATEGORIES' | 'INVENTORY';

export const PosMenuView: React.FC = () => {
  const { currentUser } = useAuth();
  const normalizedRole = normalizeUserRole(currentUser?.role);
  const isAdmin = normalizedRole === 'ADMIN';
  const isManagerOrAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER';

  const [activeTab, setActiveTab] = useState<ActiveTab>('DISHES');

  // Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDto[]>([]);
  const [uoms, setUoms] = useState<UnitOfMeasureDto[]>([]);

  // Filter States
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- DISH MODAL STATE ---
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [dishForm, setDishForm] = useState({
    categoryId: 0,
    code: '',
    name: '',
    japaneseName: '',
    description: '',
    basePrice: 85000,
    estimatedPrepMinutes: 15,
    kitchenStation: 'NoodleStation',
    imageUrl: '',
  });
  const [dishImageFile, setDishImageFile] = useState<File | null>(null);

  // --- CATEGORY MODAL STATE ---
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    categoryCode: '',
    categoryName: '',
    japaneseName: '',
    description: '',
    displayOrder: 1,
  });

  // --- INVENTORY ITEM MODAL STATE ---
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<InventoryItemDto | null>(null);
  const [inventoryForm, setInventoryForm] = useState({
    itemCode: '',
    itemName: '',
    itemCategory: 'Thịt & Hải Sản',
    uomId: 1,
    initialStock: 10,
    minimumStock: 5,
    reorderQuantity: 20,
    unitCost: 50000,
    storageLocation: 'Kho Lạnh A1',
  });

  // --- INVENTORY RESTOCK / DEDUCT MODAL STATE ---
  const [stockTxModal, setStockTxModal] = useState<{
    isOpen: boolean;
    mode: 'RESTOCK' | 'DEDUCT';
    item: InventoryItemDto | null;
  }>({ isOpen: false, mode: 'RESTOCK', item: null });
  const [stockTxForm, setStockTxForm] = useState({
    quantity: 10,
    unitCost: 0,
    referenceNumber: '',
    reason: '',
  });

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [cats, dishesRes, invList, uomList] = await Promise.all([
        menuService.getCategories().catch(() => []),
        menuService.getDishes({ pageSize: 200, includeUnavailable: true }).catch(() => ({ items: [], totalCount: 0 })),
        menuService.getInventoryItems().catch(() => []),
        menuService.getUnitsOfMeasure().catch(() => []),
      ]);
      setCategories(cats || []);
      setDishes(dishesRes.items || []);
      setInventoryItems(invList || []);
      setUoms(uomList || []);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  // ============================================================================
  // 1. DISH CRUD HANDLERS
  // ============================================================================
  const handleOpenCreateDish = () => {
    const defaultCatDbId = categories[0]?.dbId || 1;
    setEditingDish(null);
    setDishImageFile(null);
    setDishForm({
      categoryId: defaultCatDbId,
      code: `DISH-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      japaneseName: '',
      description: '',
      basePrice: 85000,
      estimatedPrepMinutes: 15,
      kitchenStation: 'NoodleStation',
      imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
    });
    setIsDishModalOpen(true);
  };

  const handleOpenEditDish = (dish: Dish) => {
    const matchedCat = categories.find(
      (c) => c.dbId === dish.categoryDbId || c.id === dish.categoryId || c.name === dish.categoryName
    );
    setEditingDish(dish);
    setDishImageFile(null);
    setDishForm({
      categoryId: matchedCat?.dbId || dish.categoryDbId || categories[0]?.dbId || 1,
      code: dish.code || '',
      name: dish.name || '',
      japaneseName: dish.japaneseName || '',
      description: dish.description || '',
      basePrice: dish.price || 0,
      estimatedPrepMinutes: dish.preparationTimeMinutes || 15,
      kitchenStation: dish.kitchenStation || 'NoodleStation',
      imageUrl: dish.imageUrl || '',
    });
    setIsDishModalOpen(true);
  };

  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishForm.name.trim()) {
      setErrorMsg('Vui lòng nhập tên món ăn.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (editingDish) {
        await menuService.updateDish(editingDish.id, {
          categoryId: Number(dishForm.categoryId),
          name: dishForm.name.trim(),
          japaneseName: dishForm.japaneseName.trim() || undefined,
          description: dishForm.description.trim() || undefined,
          basePrice: Number(dishForm.basePrice),
          estimatedPrepMinutes: Number(dishForm.estimatedPrepMinutes),
          kitchenStation: dishForm.kitchenStation,
          imageUrl: dishForm.imageUrl.trim() || undefined,
        });
        if (dishImageFile) {
          await menuService.uploadDishImage(editingDish.id, dishImageFile);
        }
        setSuccessMsg(`Đã cập nhật thông tin món "${dishForm.name}" thành công.`);
      } else {
        const created = await menuService.createDish({
          categoryId: Number(dishForm.categoryId),
          code: dishForm.code.trim().toUpperCase(),
          name: dishForm.name.trim(),
          japaneseName: dishForm.japaneseName.trim() || undefined,
          description: dishForm.description.trim() || undefined,
          basePrice: Number(dishForm.basePrice),
          estimatedPrepMinutes: Number(dishForm.estimatedPrepMinutes),
          kitchenStation: dishForm.kitchenStation,
          imageUrl: dishForm.imageUrl.trim() || undefined,
        });
        if (dishImageFile && created.id) {
          await menuService.uploadDishImage(created.id, dishImageFile);
        }
        setSuccessMsg(`Đã thêm món ăn mới "${dishForm.name}" vào thực đơn thành công.`);
      }
      setIsDishModalOpen(false);
      await loadAllData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDish = async (dish: Dish) => {
    if (!isManagerOrAdmin) {
      setErrorMsg('Chỉ Quản lý hoặc Admin mới có quyền xóa món ăn khỏi thực đơn!');
      return;
    }
    if (window.confirm(`Xác nhận xóa món "${dish.name}" khỏi thực đơn hệ thống?`)) {
      try {
        await menuService.deleteDish(dish.id);
        setSuccessMsg(`Đã xóa món "${dish.name}" thành công.`);
        await loadAllData();
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      }
    }
  };

  const handleToggleAvailability = async (dish: Dish) => {
    try {
      await menuService.updateDishStatus(dish.id, !dish.isAvailable);
      setSuccessMsg(
        `Đã chuyển món "${dish.name}" sang trạng thái ${!dish.isAvailable ? 'Còn Hàng' : 'Tạm Hết'}.`
      );
      await loadAllData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  // ============================================================================
  // 2. CATEGORY CRUD HANDLERS
  // ============================================================================
  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      categoryCode: `CAT_${Math.floor(10 + Math.random() * 90)}`,
      categoryName: '',
      japaneseName: '',
      description: '',
      displayOrder: categories.length + 1,
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({
      categoryCode: cat.code || cat.id.toUpperCase(),
      categoryName: cat.name,
      japaneseName: cat.japaneseName || '',
      description: cat.description || '',
      displayOrder: cat.displayOrder || 1,
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.categoryName.trim()) {
      setErrorMsg('Vui lòng nhập tên danh mục.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (editingCategory && editingCategory.dbId) {
        await menuService.updateCategory(editingCategory.dbId, {
          categoryName: categoryForm.categoryName.trim(),
          japaneseName: categoryForm.japaneseName.trim() || undefined,
          description: categoryForm.description.trim() || undefined,
          displayOrder: Number(categoryForm.displayOrder) || 1,
        });
        setSuccessMsg(`Đã cập nhật danh mục "${categoryForm.categoryName}" thành công.`);
      } else {
        await menuService.createCategory({
          categoryCode: categoryForm.categoryCode.trim().toUpperCase(),
          categoryName: categoryForm.categoryName.trim(),
          japaneseName: categoryForm.japaneseName.trim() || undefined,
          description: categoryForm.description.trim() || undefined,
          displayOrder: Number(categoryForm.displayOrder) || 1,
        });
        setSuccessMsg(`Đã tạo danh mục "${categoryForm.categoryName}" thành công.`);
      }
      setIsCategoryModalOpen(false);
      await loadAllData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!cat.dbId) return;
    if (window.confirm(`Xác nhận xóa danh mục "${cat.name}"?`)) {
      try {
        await menuService.deleteCategory(cat.dbId);
        setSuccessMsg(`Đã xóa danh mục "${cat.name}" thành công.`);
        await loadAllData();
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      }
    }
  };

  // ============================================================================
  // 3. INVENTORY CRUD & STOCK TRANSACTION HANDLERS
  // ============================================================================
  const handleOpenCreateInventory = () => {
    setEditingInventory(null);
    setInventoryForm({
      itemCode: `INV-${Math.floor(100 + Math.random() * 900)}`,
      itemName: '',
      itemCategory: 'Thịt & Hải Sản',
      uomId: uoms[0]?.uomId || 1,
      initialStock: 15,
      minimumStock: 5,
      reorderQuantity: 20,
      unitCost: 45000,
      storageLocation: 'Kho Lạnh A1',
    });
    setIsInventoryModalOpen(true);
  };

  const handleOpenEditInventory = (item: InventoryItemDto) => {
    const matchedUom = uoms.find((u) => u.uomCode === item.uomCode || u.uomName === item.uomName);
    setEditingInventory(item);
    setInventoryForm({
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemCategory: item.itemCategory || 'Nguyên Liệu Khác',
      uomId: matchedUom?.uomId || uoms[0]?.uomId || 1,
      initialStock: item.currentStock,
      minimumStock: item.minimumStock,
      reorderQuantity: item.reorderQuantity,
      unitCost: item.averageUnitCost,
      storageLocation: item.storageLocation || '',
    });
    setIsInventoryModalOpen(true);
  };

  const handleSaveInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryForm.itemName.trim()) {
      setErrorMsg('Vui lòng nhập tên nguyên vật liệu.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (editingInventory) {
        await menuService.updateInventoryItem(editingInventory.inventoryItemId, {
          itemName: inventoryForm.itemName.trim(),
          itemCategory: inventoryForm.itemCategory.trim(),
          uomId: Number(inventoryForm.uomId),
          minimumStock: Number(inventoryForm.minimumStock),
          reorderQuantity: Number(inventoryForm.reorderQuantity),
          averageUnitCost: Number(inventoryForm.unitCost),
          storageLocation: inventoryForm.storageLocation.trim() || undefined,
        });
        setSuccessMsg(`Đã cập nhật nguyên vật liệu "${inventoryForm.itemName}" thành công.`);
      } else {
        await menuService.createInventoryItem({
          itemCode: inventoryForm.itemCode.trim().toUpperCase(),
          itemName: inventoryForm.itemName.trim(),
          itemCategory: inventoryForm.itemCategory.trim(),
          uomId: Number(inventoryForm.uomId),
          initialStock: Number(inventoryForm.initialStock),
          minimumStock: Number(inventoryForm.minimumStock),
          reorderQuantity: Number(inventoryForm.reorderQuantity),
          unitCost: Number(inventoryForm.unitCost),
          storageLocation: inventoryForm.storageLocation.trim() || undefined,
        });
        setSuccessMsg(`Đã thêm nguyên vật liệu "${inventoryForm.itemName}" vào kho thành công.`);
      }
      setIsInventoryModalOpen(false);
      await loadAllData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInventory = async (item: InventoryItemDto) => {
    if (window.confirm(`Xác nhận xóa nguyên vật liệu "${item.itemName}" (${item.itemCode}) khỏi danh mục kho?`)) {
      try {
        await menuService.deleteInventoryItem(item.inventoryItemId);
        setSuccessMsg(`Đã xóa nguyên vật liệu "${item.itemName}" khỏi danh mục kho.`);
        await loadAllData();
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      }
    }
  };

  const handleOpenStockTxModal = (item: InventoryItemDto, mode: 'RESTOCK' | 'DEDUCT') => {
    setStockTxModal({ isOpen: true, mode, item });
    setStockTxForm({
      quantity: mode === 'RESTOCK' ? Math.max(1, item.reorderQuantity || 10) : 1,
      unitCost: item.averageUnitCost || 0,
      referenceNumber: mode === 'RESTOCK' ? `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}` : '',
      reason: mode === 'RESTOCK' ? 'Nhập hàng bổ sung định kỳ' : 'Xuất kho chế biến / Kiểm kê hao hụt',
    });
  };

  const handleConfirmStockTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = stockTxModal.item;
    if (!item) return;
    if (stockTxForm.quantity <= 0) {
      setErrorMsg('Số lượng phải lớn hơn 0.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (stockTxModal.mode === 'RESTOCK') {
        await menuService.restockInventoryItem({
          inventoryItemId: item.inventoryItemId,
          quantity: Number(stockTxForm.quantity),
          unitCost: Number(stockTxForm.unitCost),
          referenceNumber: stockTxForm.referenceNumber.trim() || undefined,
          reason: stockTxForm.reason.trim() || undefined,
        });
        setSuccessMsg(
          `Đã nhập thêm +${stockTxForm.quantity} ${item.uomName} cho "${item.itemName}" thành công.`
        );
      } else {
        await menuService.deductInventoryItem({
          inventoryItemId: item.inventoryItemId,
          quantity: Number(stockTxForm.quantity),
          reason: stockTxForm.reason.trim() || 'Xuất kho kiểm kê',
        });
        setSuccessMsg(
          `Đã xuất -${stockTxForm.quantity} ${item.uomName} từ "${item.itemName}" thành công.`
        );
      }
      setStockTxModal({ isOpen: false, mode: 'RESTOCK', item: null });
      await loadAllData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Lists
  const filteredDishes = dishes.filter((d) => {
    if (selectedCat !== 'all' && d.categoryId !== selectedCat && String(d.categoryDbId) !== selectedCat) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.japaneseName && d.japaneseName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const inventoryCategories = Array.from(
    new Set(inventoryItems.map((i) => i.itemCategory).filter(Boolean))
  );

  const filteredInventory = inventoryItems.filter((item) => {
    if (inventoryCategoryFilter === 'LOW_STOCK' && !item.isLowStock) return false;
    if (
      inventoryCategoryFilter !== 'ALL' &&
      inventoryCategoryFilter !== 'LOW_STOCK' &&
      item.itemCategory !== inventoryCategoryFilter
    ) {
      return false;
    }
    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase();
      return (
        item.itemName.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q) ||
        (item.storageLocation && item.storageLocation.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
            <Utensils className="w-6 h-6 text-emerald-600" />
            <span>Thực Đơn, Danh Mục &amp; Quản Lý Kho Nguyên Liệu</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý toàn diện (CRUD) món ăn, danh mục thực đơn và nhập/xuất tồn kho nguyên vật liệu theo thời gian thực
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'DISHES' && isManagerOrAdmin && (
            <button
              type="button"
              onClick={handleOpenCreateDish}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Món Ăn Mới</span>
            </button>
          )}

          {activeTab === 'CATEGORIES' && isManagerOrAdmin && (
            <button
              type="button"
              onClick={handleOpenCreateCategory}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Danh Mục Mới</span>
            </button>
          )}

          {activeTab === 'INVENTORY' && isManagerOrAdmin && (
            <button
              type="button"
              onClick={handleOpenCreateInventory}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Nguyên Liệu Mới</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadAllData()}
            className="p-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 shrink-0"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs: DISHES | CATEGORIES | INVENTORY */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('DISHES')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'DISHES'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Thực Đơn Món Ăn ({dishes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CATEGORIES')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'CATEGORIES'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Quản Lý Danh Mục ({categories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('INVENTORY')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'INVENTORY'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Kho Nguyên Vật Liệu ({inventoryItems.length})</span>
          {inventoryItems.some((i) => i.isLowStock) && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-black">
              {inventoryItems.filter((i) => i.isLowStock).length} sắp hết
            </span>
          )}
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==========================================================================
          TAB 1: DISHES MANAGEMENT
      ========================================================================== */}
      {activeTab === 'DISHES' && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold max-w-full pb-1">
              <button
                type="button"
                onClick={() => setSelectedCat('all')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  selectedCat === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tất Cả ({dishes.length})
              </button>
              {categories.map((c) => {
                const count = dishes.filter(
                  (d) => d.categoryId === c.id || (c.dbId && d.categoryDbId === c.dbId)
                ).length;
                return (
                  <button
                    key={c.dbId || c.id}
                    type="button"
                    onClick={() => setSelectedCat(c.id)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      selectedCat === c.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {c.name} ({count})
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo mã, tên món hoặc tên tiếng Nhật..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tên Món Ăn</th>
                    <th className="py-3 px-4">Tên Tiếng Nhật</th>
                    <th className="py-3 px-4">Danh Mục</th>
                    <th className="py-3 px-4 text-right">Đơn Giá</th>
                    <th className="py-3 px-4 text-center">Trạng Thái Bán</th>
                    <th className="py-3 px-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading && dishes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Đang tải danh mục thực đơn từ SQL Server...
                      </td>
                    </tr>
                  ) : filteredDishes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                        Không tìm thấy món ăn nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredDishes.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-950">
                          <div className="flex items-center gap-3">
                            {d.imageUrl ? (
                              <img
                                src={d.imageUrl}
                                alt={d.name}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                                <Utensils className="w-5 h-5" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-950 text-xs">{d.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                Mã: {d.code} • ID #{d.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-semibold text-emerald-700">
                          {d.japaneseName || '—'}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                          {d.categoryName || d.categoryId}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-black text-slate-950 text-xs">
                          {formatVND(d.price)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => void handleToggleAvailability(d)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${
                              d.isAvailable !== false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                            }`}
                            title="Bấm để bật/tắt trạng thái còn món"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                d.isAvailable !== false ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                            />
                            <span>{d.isAvailable !== false ? 'Còn Hàng' : 'Tạm Hết'}</span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDish(d)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                              title="Chỉnh sửa thông tin món"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Sửa</span>
                            </button>

                            {isManagerOrAdmin && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteDish(d)}
                                className="px-2.5 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                                title="Xóa món ăn"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                Tổng số: <strong>{filteredDishes.length}</strong> món ăn
              </span>
              <span>Dữ liệu thời gian thực từ SQL Server</span>
            </div>
          </div>
        </>
      )}

      {/* ==========================================================================
          TAB 2: CATEGORIES MANAGEMENT (FULL CRUD)
      ========================================================================== */}
      {activeTab === 'CATEGORIES' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Thứ Tự</th>
                  <th className="py-3 px-4">Mã Danh Mục</th>
                  <th className="py-3 px-4">Tên Danh Mục</th>
                  <th className="py-3 px-4">Tên Tiếng Nhật</th>
                  <th className="py-3 px-4">Mô Tả</th>
                  <th className="py-3 px-4 text-center">Số Món</th>
                  <th className="py-3 px-4 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                      Chưa có danh mục món ăn nào.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => {
                    const count = dishes.filter(
                      (d) => d.categoryId === cat.id || (cat.dbId && d.categoryDbId === cat.dbId)
                    ).length;
                    return (
                      <tr key={cat.dbId || cat.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          #{cat.displayOrder}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {cat.code || cat.id.toUpperCase()}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-950">{cat.name}</td>
                        <td className="py-3.5 px-4 font-semibold text-emerald-700">
                          {cat.japaneseName || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {cat.description || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold text-[11px]">
                            {count} món
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCategory(cat)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Sửa</span>
                            </button>
                            {isManagerOrAdmin && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteCategory(cat)}
                                className="px-2.5 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Tổng số: <strong>{categories.length}</strong> danh mục thực đơn
            </span>
            <span>Quản lý danh mục món ăn chuẩn nhà hàng Nhật Bản</span>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 3: INVENTORY MANAGEMENT (FULL CRUD + RESTOCK + DEDUCT)
      ========================================================================== */}
      {activeTab === 'INVENTORY' && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold max-w-full pb-1">
              <button
                type="button"
                onClick={() => setInventoryCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  inventoryCategoryFilter === 'ALL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tất Cả ({inventoryItems.length})
              </button>
              <button
                type="button"
                onClick={() => setInventoryCategoryFilter('LOW_STOCK')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  inventoryCategoryFilter === 'LOW_STOCK'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                }`}
              >
                Cảnh Báo Sắp Hết ({inventoryItems.filter((i) => i.isLowStock).length})
              </button>
              {inventoryCategories.map((catName) => (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setInventoryCategoryFilter(catName)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                    inventoryCategoryFilter === catName
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {catName} ({inventoryItems.filter((i) => i.itemCategory === catName).length})
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã SKU, tên nguyên liệu, vị trí kho..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Mã SKU</th>
                    <th className="py-3 px-4">Tên Nguyên Vật Liệu</th>
                    <th className="py-3 px-4">Nhóm Kho</th>
                    <th className="py-3 px-4 text-right">Tồn Hiện Tại</th>
                    <th className="py-3 px-4 text-right">Tồn Tối Thiểu</th>
                    <th className="py-3 px-4 text-right">Giá Vốn BQ</th>
                    <th className="py-3 px-4">Vị Trí Kho</th>
                    <th className="py-3 px-4 text-center">Thao Tác Kho &amp; CRUD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                        Không tìm thấy nguyên vật liệu nào trong kho.
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => (
                      <tr key={item.inventoryItemId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {item.itemCode}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-950">
                          <div className="flex items-center gap-2">
                            <span>{item.itemName}</span>
                            {item.isLowStock && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                Sắp hết
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{item.itemCategory}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-black">
                          <span className={item.isLowStock ? 'text-red-600' : 'text-emerald-700'}>
                            {item.currentStock} {item.uomName}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                          {item.minimumStock} {item.uomName}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatVND(item.averageUnitCost)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {item.storageLocation || 'Kho Bếp Chính'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-wrap items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenStockTxModal(item, 'RESTOCK')}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1"
                              title="Nhập thêm hàng vào kho"
                            >
                              <ArrowDownToLine className="w-3 h-3" />
                              <span>Nhập</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenStockTxModal(item, 'DEDUCT')}
                              className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold inline-flex items-center gap-1"
                              title="Xuất kho / Kiểm kê hao hụt"
                            >
                              <ArrowUpFromLine className="w-3 h-3" />
                              <span>Xuất</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditInventory(item)}
                              className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1"
                              title="Sửa thông tin nguyên liệu"
                            >
                              <Edit2 className="w-3 h-3 text-emerald-600" />
                              <span>Sửa</span>
                            </button>
                            {isManagerOrAdmin && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteInventory(item)}
                                className="px-2 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-[11px] font-bold inline-flex items-center gap-1"
                                title="Xóa nguyên liệu"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                Tổng số: <strong>{filteredInventory.length}</strong> mặt hàng nguyên vật liệu
              </span>
              <span>Tự động bình quân gia quyền giá vốn khi nhập kho</span>
            </div>
          </div>
        </>
      )}

      {/* ==========================================================================
          MODAL 1: CREATE / EDIT DISH
      ========================================================================== */}
      {isDishModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-400" />
                <span>{editingDish ? `Chỉnh Sửa Món: ${editingDish.name}` : 'Thêm Món Ăn Mới Vào Thực Đơn'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsDishModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveDish(e)} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã món (Code) *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingDish)}
                    value={dishForm.code}
                    onChange={(e) => setDishForm({ ...dishForm, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Danh mục thực đơn *</label>
                  <select
                    value={dishForm.categoryId}
                    onChange={(e) => setDishForm({ ...dishForm, categoryId: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                  >
                    {categories.map((cat) => (
                      <option key={cat.dbId || cat.id} value={cat.dbId || 1}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên món ăn (Tiếng Việt) *</label>
                  <input
                    type="text"
                    required
                    value={dishForm.name}
                    onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })}
                    placeholder="VD: Ramen Tonkotsu Chashu Đặc Biệt"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên tiếng Nhật (Kanji / Kana)</label>
                  <input
                    type="text"
                    value={dishForm.japaneseName}
                    onChange={(e) => setDishForm({ ...dishForm, japaneseName: e.target.value })}
                    placeholder="VD: 豚骨チャーシューラーメン"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn giá bán (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={1000}
                    value={dishForm.basePrice}
                    onChange={(e) => setDishForm({ ...dishForm, basePrice: Number(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Thời gian chuẩn bị (Phút)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={dishForm.estimatedPrepMinutes}
                    onChange={(e) =>
                      setDishForm({ ...dishForm, estimatedPrepMinutes: Number(e.target.value) || 15 })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trạm bếp chế biến (KDS)</label>
                  <select
                    value={dishForm.kitchenStation}
                    onChange={(e) => setDishForm({ ...dishForm, kitchenStation: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="NoodleStation">Trạm Mì Ramen &amp; Udon (NoodleStation)</option>
                    <option value="FryGrillStation">Trạm Nướng &amp; Chiên Tempura (FryGrillStation)</option>
                    <option value="ColdDessertStation">Trạm Món Lạnh &amp; Sashimi/Dessert (ColdDessertStation)</option>
                    <option value="BeverageStation">Trạm Pha Chế &amp; Đồ Uống (BeverageStation)</option>
                    <option value="Expo">Trạm Ra Món Tổng (Expo)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đường dẫn ảnh món ăn (Image URL)</label>
                  <input
                    type="text"
                    value={dishForm.imageUrl}
                    onChange={(e) => setDishForm({ ...dishForm, imageUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hoặc tải tệp ảnh từ máy tính (Tùy chọn)
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 text-xs text-slate-600">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>{dishImageFile ? dishImageFile.name : 'Chọn tệp hình ảnh (.jpg, .png, .webp)...'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDishImageFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả chi tiết món ăn</label>
                  <textarea
                    rows={3}
                    value={dishForm.description}
                    onChange={(e) => setDishForm({ ...dishForm, description: e.target.value })}
                    placeholder="Mô tả hương vị, thành phần đặc trưng của món ăn..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider"
                >
                  {isSubmitting ? 'Đang lưu...' : editingDish ? 'Lưu Cập Nhật Món' : 'Tạo Món Ăn Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL 2: CREATE / EDIT CATEGORY
      ========================================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>{editingCategory ? `Sửa Danh Mục: ${editingCategory.name}` : 'Thêm Danh Mục Thực Đơn'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveCategory(e)} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Danh Mục *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingCategory)}
                    value={categoryForm.categoryCode}
                    onChange={(e) => setCategoryForm({ ...categoryForm, categoryCode: e.target.value })}
                    placeholder="VD: RAMEN"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Thứ Tự Hiển Thị</label>
                  <input
                    type="number"
                    min={1}
                    value={categoryForm.displayOrder}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, displayOrder: Number(e.target.value) || 1 })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Danh Mục (Tiếng Việt) *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.categoryName}
                  onChange={(e) => setCategoryForm({ ...categoryForm, categoryName: e.target.value })}
                  placeholder="VD: Mì Ramen & Udon Truyền Thống"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Tiếng Nhật</label>
                <input
                  type="text"
                  value={categoryForm.japaneseName}
                  onChange={(e) => setCategoryForm({ ...categoryForm, japaneseName: e.target.value })}
                  placeholder="VD: ラーメン・うどん"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô Tả Danh Mục</label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Mô tả ngắn gọn về nhóm món ăn này..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase"
                >
                  {isSubmitting ? 'Đang lưu...' : editingCategory ? 'Lưu Cập Nhật' : 'Tạo Danh Mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL 3: CREATE / EDIT INVENTORY ITEM
      ========================================================================== */}
      {isInventoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <span>
                  {editingInventory
                    ? `Sửa Nguyên Liệu: ${editingInventory.itemName}`
                    : 'Thêm Nguyên Vật Liệu Mới Vào Kho'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsInventoryModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveInventory(e)} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã SKU Nguyên Liệu *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingInventory)}
                    value={inventoryForm.itemCode}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, itemCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nhóm Nguyên Liệu *</label>
                  <input
                    type="text"
                    required
                    value={inventoryForm.itemCategory}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, itemCategory: e.target.value })}
                    placeholder="VD: Thịt & Hải Sản, Rau Củ, Gia Vị Nhật"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên Nguyên Vật Liệu *</label>
                  <input
                    type="text"
                    required
                    value={inventoryForm.itemName}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, itemName: e.target.value })}
                    placeholder="VD: Cá Hồi Na Uy Tươi Phi Lê (Sashimi Grade)"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn Vị Tính (ĐVT) *</label>
                  <select
                    value={inventoryForm.uomId}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, uomId: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                  >
                    {uoms.map((u) => (
                      <option key={u.uomId} value={u.uomId}>
                        {u.uomName} ({u.uomCode})
                      </option>
                    ))}
                  </select>
                </div>

                {!editingInventory && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Số Lượng Tồn Đầu Kỳ</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={inventoryForm.initialStock}
                      onChange={(e) =>
                        setInventoryForm({ ...inventoryForm, initialStock: Number(e.target.value) || 0 })
                      }
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Định Mức Tồn Tối Thiểu</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={inventoryForm.minimumStock}
                    onChange={(e) =>
                      setInventoryForm({ ...inventoryForm, minimumStock: Number(e.target.value) || 0 })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Định Mức Nhập Bổ Sung</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={inventoryForm.reorderQuantity}
                    onChange={(e) =>
                      setInventoryForm({ ...inventoryForm, reorderQuantity: Number(e.target.value) || 0 })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn Giá Vốn (VNĐ)</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={inventoryForm.unitCost}
                    onChange={(e) =>
                      setInventoryForm({ ...inventoryForm, unitCost: Number(e.target.value) || 0 })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div className={editingInventory ? '' : 'sm:col-span-2'}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vị Trí Lưu Trữ Kho</label>
                  <input
                    type="text"
                    value={inventoryForm.storageLocation}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, storageLocation: e.target.value })}
                    placeholder="VD: Kho Lạnh A1 / Kệ Khô B2"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInventoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase"
                >
                  {isSubmitting ? 'Đang lưu...' : editingInventory ? 'Lưu Cập Nhật' : 'Tạo Nguyên Liệu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL 4: RESTOCK / DEDUCT INVENTORY STOCK
      ========================================================================== */}
      {stockTxModal.isOpen && stockTxModal.item && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div
              className={`px-5 py-4 text-white flex items-center justify-between ${
                stockTxModal.mode === 'RESTOCK' ? 'bg-emerald-700' : 'bg-amber-700'
              }`}
            >
              <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                {stockTxModal.mode === 'RESTOCK' ? (
                  <>
                    <ArrowDownToLine className="w-4 h-4" />
                    <span>Nhập Kho Nguyên Liệu</span>
                  </>
                ) : (
                  <>
                    <ArrowUpFromLine className="w-4 h-4" />
                    <span>Xuất Kho / Kiểm Kê Hao Hụt</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setStockTxModal({ isOpen: false, mode: 'RESTOCK', item: null })}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleConfirmStockTx(e)} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-950">{stockTxModal.item.itemName}</p>
                <p className="text-slate-500">
                  Mã SKU: <strong className="font-mono">{stockTxModal.item.itemCode}</strong> • Tồn hiện tại:{' '}
                  <strong className="text-emerald-700 font-mono">
                    {stockTxModal.item.currentStock} {stockTxModal.item.uomName}
                  </strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số lượng {stockTxModal.mode === 'RESTOCK' ? 'nhập thêm' : 'xuất kho'} ({stockTxModal.item.uomName}) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min={0.01}
                  value={stockTxForm.quantity}
                  onChange={(e) => setStockTxForm({ ...stockTxForm, quantity: Number(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900"
                />
              </div>

              {stockTxModal.mode === 'RESTOCK' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Đơn giá nhập trên 1 {stockTxModal.item.uomName} (VNĐ) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={500}
                      value={stockTxForm.unitCost}
                      onChange={(e) => setStockTxForm({ ...stockTxForm, unitCost: Number(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mã phiếu nhập (PO / Hóa đơn)</label>
                    <input
                      type="text"
                      value={stockTxForm.referenceNumber}
                      onChange={(e) => setStockTxForm({ ...stockTxForm, referenceNumber: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lý do / Ghi chú phiếu kho *</label>
                <input
                  type="text"
                  required
                  value={stockTxForm.reason}
                  onChange={(e) => setStockTxForm({ ...stockTxForm, reason: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStockTxModal({ isOpen: false, mode: 'RESTOCK', item: null })}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-bold uppercase ${
                    stockTxModal.mode === 'RESTOCK'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isSubmitting
                    ? 'Đang xử lý...'
                    : stockTxModal.mode === 'RESTOCK'
                    ? 'Xác Nhận Nhập Kho'
                    : 'Xác Nhận Xuất Kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
