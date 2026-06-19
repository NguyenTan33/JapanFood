import { apiClient } from './apiClient';
import { Dish, Category, DishOptionGroup } from '@/types';

export interface DishFilterParams {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  keyword?: string;
  isFeatured?: boolean;
  includeUnavailable?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
}

export interface InventoryItemDto {
  inventoryItemId: number;
  itemCode: string;
  itemName: string;
  itemCategory: string;
  uomCode: string;
  uomName: string;
  currentStock: number;
  minimumStock: number;
  reorderQuantity: number;
  averageUnitCost: number;
  storageLocation?: string;
  isActive: boolean;
  isLowStock: boolean;
  lastRestockedAt?: string;
}

export interface UnitOfMeasureDto {
  uomId: number;
  uomCode: string;
  uomName: string;
}

export const mapCategoryDto = (dto: any): Category => ({
  id: dto.categoryCode?.toLowerCase() || String(dto.categoryId),
  dbId: Number(dto.categoryId || dto.id || 0),
  code: dto.categoryCode || '',
  name: dto.categoryName || dto.name || '',
  japaneseName: dto.japaneseName || '',
  description: dto.description || '',
  iconName: dto.iconName || 'Utensils',
  displayOrder: dto.displayOrder || 0,
  dishCount: dto.dishCount ?? dto.dishes?.length ?? 0,
  imageUrl: dto.imageUrl || '',
  isActive: dto.isActive ?? true,
});

export const mapDishDto = (dto: any): Dish => {
  const optionGroups: DishOptionGroup[] = (dto.modifierGroups || dto.optionGroups || []).map((mg: any) => ({
    id: mg.groupId || mg.id || 0,
    code: mg.groupCode || mg.code || '',
    name: mg.groupName || mg.name || '',
    isRequired: mg.isRequired ?? ((mg.minSelection || 0) > 0),
    minSelection: mg.minSelection ?? 0,
    maxSelection: mg.maxSelection ?? 1,
    options: (mg.options || []).map((opt: any) => ({
      id: opt.optionId || opt.id || 0,
      code: opt.optionCode || opt.code || '',
      name: opt.optionName || opt.name || '',
      priceAdjustment: Number(opt.priceAdjustment ?? 0),
      isDefault: opt.isDefault ?? false,
      isAvailable: opt.isAvailable ?? true,
    })),
  }));

  return {
    id: dto.dishId || dto.id || 0,
    code: dto.code || '',
    name: dto.name || '',
    japaneseName: dto.japaneseName || '',
    slug: dto.slug || '',
    categoryId: dto.categoryCode?.toLowerCase() || String(dto.categoryId || ''),
    categoryDbId: Number(dto.categoryId || 0),
    categoryName: dto.categoryName || '',
    price: Number(dto.basePrice ?? dto.price ?? 0),
    originalPrice: dto.originalPrice ? Number(dto.originalPrice) : undefined,
    description: dto.description || '',
    imageUrl: dto.imageUrl || '',
    tags: Array.isArray(dto.tags) ? dto.tags : [],
    rating: Number(dto.averageRating ?? dto.rating ?? 5.0),
    reviewCount: Number(dto.totalReviews ?? dto.reviewCount ?? 0),
    ingredients: Array.isArray(dto.ingredients) ? dto.ingredients : [],
    spiceLevel: dto.spiceLevel ?? 0,
    calories: dto.calories,
    preparationTimeMinutes: dto.estimatedPrepMinutes ?? dto.preparationTimeMinutes ?? 12,
    kitchenStation: dto.kitchenStation || 'NoodleStation',
    isAvailable: dto.isAvailable ?? true,
    isFeatured: dto.isFeatured ?? false,
    optionGroups,
  };
};

export const menuService = {
  async getCategories(): Promise<Category[]> {
    const { data } = await apiClient.get('/menu/categories');
    const list = Array.isArray(data) ? data : (data?.items || []);
    return list.map(mapCategoryDto);
  },

  async getDishes(params?: DishFilterParams): Promise<{ items: Dish[]; totalCount: number }> {
    const apiParams: Record<string, any> = {};
    if (params?.categoryId && params.categoryId !== 'all') {
      apiParams.categoryId = params.categoryId;
    }
    if (params?.keyword) apiParams.keyword = params.keyword;
    if (params?.minPrice !== undefined) apiParams.minPrice = params.minPrice;
    if (params?.maxPrice !== undefined) apiParams.maxPrice = params.maxPrice;
    if (params?.isFeatured !== undefined) apiParams.isFeatured = params.isFeatured;
    if (params?.includeUnavailable !== undefined) apiParams.includeUnavailable = params.includeUnavailable;
    if (params?.page) apiParams.page = params.page;
    if (params?.pageSize) apiParams.pageSize = params.pageSize;
    if (params?.sortBy) apiParams.sortBy = params.sortBy;

    const { data } = await apiClient.get('/menu/dishes', { params: apiParams });
    const rawItems = data?.items || (Array.isArray(data) ? data : []);
    const items = rawItems.map(mapDishDto);
    const totalCount = data?.totalCount ?? items.length;
    return { items, totalCount };
  },

  async getDishDetail(code: string): Promise<Dish | null> {
    try {
      const { data } = await apiClient.get(`/menu/dishes/${code}`);
      return data ? mapDishDto(data) : null;
    } catch {
      return null;
    }
  },

  async createDish(payload: {
    categoryId: number;
    code: string;
    name: string;
    japaneseName?: string;
    description?: string;
    basePrice: number;
    estimatedPrepMinutes: number;
    kitchenStation: string;
    imageUrl?: string;
  }): Promise<Dish> {
    const { data } = await apiClient.post('/menu/dishes', payload);
    return mapDishDto(data);
  },

  async updateDish(
    id: number,
    payload: {
      categoryId?: number;
      name: string;
      japaneseName?: string;
      description?: string;
      basePrice: number;
      estimatedPrepMinutes: number;
      kitchenStation: string;
      imageUrl?: string;
    }
  ): Promise<Dish> {
    const { data } = await apiClient.put(`/menu/dishes/${id}`, payload);
    return mapDishDto(data);
  },

  async uploadDishImage(id: number, file: File): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post(`/menu/dishes/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async updateDishStatus(id: number, isAvailable: boolean): Promise<void> {
    await apiClient.patch(`/menu/dishes/${id}/availability`, { isAvailable });
  },

  async deleteDish(id: number): Promise<void> {
    await apiClient.delete(`/menu/dishes/${id}`);
  },

  async createCategory(payload: {
    categoryCode: string;
    categoryName: string;
    japaneseName?: string;
    description?: string;
    iconName?: string;
    imageUrl?: string;
    displayOrder: number;
  }): Promise<Category> {
    const { data } = await apiClient.post('/menu/categories', payload);
    return mapCategoryDto(data);
  },

  async updateCategory(
    id: number,
    payload: {
      categoryName: string;
      japaneseName?: string;
      description?: string;
      iconName?: string;
      imageUrl?: string;
      displayOrder: number;
    }
  ): Promise<Category> {
    const { data } = await apiClient.put(`/menu/categories/${id}`, payload);
    return mapCategoryDto(data);
  },

  async updateCategoryStatus(id: number, isActive: boolean): Promise<void> {
    await apiClient.patch(`/menu/categories/${id}/status`, { isActive });
  },

  async deleteCategory(id: number): Promise<void> {
    await apiClient.delete(`/menu/categories/${id}`);
  },

  // --- INVENTORY CRUD & STOCK TRANSACTIONS ---
  async getInventoryItems(): Promise<InventoryItemDto[]> {
    const { data } = await apiClient.get<any[]>('/inventory');
    const raw = Array.isArray(data) ? data : [];
    return raw.map((it) => {
      const currentStock = Number(it.currentStock ?? 0);
      const minimumStock = Number(it.minimumStock ?? 0);
      return {
        inventoryItemId: Number(it.inventoryItemId ?? it.id ?? 0),
        itemCode: it.itemCode || it.sku || '',
        itemName: it.itemName || it.name || '',
        itemCategory: it.itemCategory || it.category || 'Nguyên Liệu',
        uomCode: it.uomCode || it.primaryUomName || 'ĐVT',
        uomName: it.uomName || it.primaryUomName || 'ĐVT',
        currentStock,
        minimumStock,
        reorderQuantity: Number(it.reorderQuantity ?? Math.max(10, minimumStock * 2)),
        averageUnitCost: Number(it.averageUnitCost ?? it.unitCost ?? 0),
        storageLocation: it.storageLocation || 'Kho Bếp Chính',
        isActive: it.isActive ?? true,
        isLowStock: it.isLowStock ?? currentStock <= minimumStock,
        lastRestockedAt: it.lastRestockedAt,
      };
    });
  },

  async getUnitsOfMeasure(): Promise<UnitOfMeasureDto[]> {
    const { data } = await apiClient.get<any[]>('/inventory/uoms');
    const raw = Array.isArray(data) ? data : [];
    return raw.map((u) => ({
      uomId: Number(u.uomId ?? u.id ?? 1),
      uomCode: u.uomCode || u.code || '',
      uomName: u.uomName || u.name || '',
    }));
  },

  async createInventoryItem(payload: {
    itemCode: string;
    itemName: string;
    itemCategory: string;
    uomId: number;
    initialStock: number;
    minimumStock: number;
    reorderQuantity: number;
    unitCost: number;
    storageLocation?: string;
  }): Promise<InventoryItemDto> {
    const { data } = await apiClient.post<any>('/inventory', {
      sku: payload.itemCode,
      name: payload.itemName,
      category: payload.itemCategory,
      primaryUomId: payload.uomId,
      initialStock: payload.initialStock,
      minimumStock: payload.minimumStock,
      unitCost: payload.unitCost,
      storageLocation: payload.storageLocation,
    });
    const currentStock = Number(data.currentStock ?? payload.initialStock ?? 0);
    const minimumStock = Number(data.minimumStock ?? payload.minimumStock ?? 0);
    return {
      inventoryItemId: Number(data.inventoryItemId ?? data.id ?? 0),
      itemCode: data.itemCode || data.sku || payload.itemCode,
      itemName: data.itemName || data.name || payload.itemName,
      itemCategory: data.itemCategory || data.category || payload.itemCategory,
      uomCode: data.uomCode || data.primaryUomName || 'ĐVT',
      uomName: data.uomName || data.primaryUomName || 'ĐVT',
      currentStock,
      minimumStock,
      reorderQuantity: payload.reorderQuantity,
      averageUnitCost: Number(data.averageUnitCost ?? data.unitCost ?? payload.unitCost ?? 0),
      storageLocation: data.storageLocation || payload.storageLocation,
      isActive: data.isActive ?? true,
      isLowStock: currentStock <= minimumStock,
    };
  },

  async updateInventoryItem(
    id: number,
    payload: {
      itemName: string;
      itemCategory: string;
      uomId: number;
      minimumStock: number;
      reorderQuantity: number;
      averageUnitCost: number;
      storageLocation?: string;
    }
  ): Promise<InventoryItemDto> {
    const { data } = await apiClient.put<any>(`/inventory/${id}`, {
      name: payload.itemName,
      category: payload.itemCategory,
      primaryUomId: payload.uomId,
      minimumStock: payload.minimumStock,
      unitCost: payload.averageUnitCost,
      storageLocation: payload.storageLocation,
    });
    const currentStock = Number(data.currentStock ?? 0);
    const minimumStock = Number(data.minimumStock ?? payload.minimumStock ?? 0);
    return {
      inventoryItemId: Number(data.inventoryItemId ?? data.id ?? id),
      itemCode: data.itemCode || data.sku || '',
      itemName: data.itemName || data.name || payload.itemName,
      itemCategory: data.itemCategory || data.category || payload.itemCategory,
      uomCode: data.uomCode || data.primaryUomName || 'ĐVT',
      uomName: data.uomName || data.primaryUomName || 'ĐVT',
      currentStock,
      minimumStock,
      reorderQuantity: payload.reorderQuantity,
      averageUnitCost: Number(data.averageUnitCost ?? data.unitCost ?? payload.averageUnitCost ?? 0),
      storageLocation: data.storageLocation || payload.storageLocation,
      isActive: data.isActive ?? true,
      isLowStock: currentStock <= minimumStock,
    };
  },

  async deleteInventoryItem(id: number): Promise<void> {
    await apiClient.delete(`/inventory/${id}`);
  },

  async restockInventoryItem(payload: {
    inventoryItemId: number;
    quantity: number;
    unitCost: number;
    referenceNumber?: string;
    reason?: string;
  }): Promise<InventoryItemDto> {
    const { data } = await apiClient.post<InventoryItemDto>('/inventory/restock', payload);
    return data;
  },

  async deductInventoryItem(payload: {
    inventoryItemId: number;
    quantity: number;
    reason?: string;
  }): Promise<void> {
    await apiClient.post('/inventory/deduct', payload);
  },
};
