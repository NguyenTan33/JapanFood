import { apiClient } from './apiClient';

export interface CreateOrderOrderItemDto {
  menuItemId: number;
  quantity: number;
  modifierOptionIds?: number[];
  specialInstructions?: string;
}

export interface CreateOrderRequest {
  orderType: 'DineIn' | 'Takeaway' | 'Delivery';
  tableId?: number;
  deliveryAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
  items: CreateOrderOrderItemDto[];
  voucherCode?: string;
  paymentMethod?: 'FullBank' | 'Cod50Deposit';
  notes?: string;
}

export interface OrderItemModifierViewDto {
  modifierOptionName: string;
  priceAdjustment: number;
  quantity: number;
}

export interface OrderItemViewDto {
  orderItemId: number;
  menuItemId: number;
  dishCode: string;
  itemName: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  modifiersPrice: number;
  totalPrice: number;
  itemStatus: string;
  specialInstructions?: string;
  modifiers: OrderItemModifierViewDto[];
}

export interface OrderDetailViewDto {
  orderId: number;
  userId?: number;
  orderNumber: string;
  status: string;
  orderType: string;
  guestCount: number;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  depositRate: number;
  depositAmount: number;
  remainingCodAmount: number;
  paymentMethod?: string;
  deliveryAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
  tableNumber?: string;
  areaName?: string;
  voucherCode?: string;
  isReviewed?: boolean;
  items: OrderItemViewDto[];
}

export interface PagedOrderHistory {
  items: OrderDetailViewDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export const orderService = {
  async createOrder(request: CreateOrderRequest): Promise<OrderDetailViewDto> {
    const { data } = await apiClient.post<OrderDetailViewDto>('/orders', request);
    return data;
  },

  async getOrder(id: number | string): Promise<OrderDetailViewDto> {
    const { data } = await apiClient.get(`/orders/${id}`);
    return data;
  },

  async getMyOrderHistory(page = 1, pageSize = 10): Promise<PagedOrderHistory> {
    const { data } = await apiClient.get<PagedOrderHistory>('/orders/my-history', {
      params: { page, pageSize },
    });
    return data;
  },

  async checkout(orderId: number | string, gateway: 'VnPay' | 'MoMo' | 'Cash', returnUrl: string) {
    const { data } = await apiClient.post(`/orders/${orderId}/checkout`, {
      gateway,
      returnUrl,
    });
    return data;
  },

  async completeDelivery(orderId: number | string): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>(`/orders/${orderId}/complete-delivery`);
    return data;
  },
};
