import { apiClient, getErrorMessage } from './apiClient';
import { OrderDetailViewDto } from './orderService';

export interface PosTable {
  tableId: number;
  tableNumber: string;
  capacity: number;
  minCapacity: number;
  areaId: number;
  areaName: string;
  floor?: string | null;
  status: 'Empty' | 'Serving' | 'Reserved' | 'Cleaning' | string;
  currentOrderId?: number | null;
  activeOrderId?: number | null;
  mergedIntoTableId?: number | null;
  guestCount?: number;
  openedAt?: string | null;
  totalAmount?: number;
  currentTotal?: number;
  reservationTime?: string | null;
  sessionToken?: string;
  pinCode?: string;
}

export interface PosArea {
  areaId: number;
  id?: number;
  code: string;
  name: string;
  japaneseName?: string;
  description?: string;
  floor?: string | null;
  displayOrder?: number;
}

export interface OpenTableRequest {
  guestCount: number;
  notes?: string;
}

export interface OpenTableResponse {
  tableId: number;
  tableNumber: string;
  orderId: number;
  orderNumber: string;
  sessionToken: string;
  pinCode: string;
  orderQrUrl: string;
  vietQrUrl: string;
  openedAt: string;
}

export interface AddItemToOrderRequest {
  orderId: number;
  items: Array<{
    menuItemId: number;
    quantity: number;
    modifierOptionIds?: number[];
    specialInstructions?: string;
  }>;
  sendDirectlyToKitchen?: boolean;
}

export interface CancelOrderItemRequest {
  orderId: number;
  orderItemId: number;
  reason: string;
}

export interface SplitOrderRequest {
  sourceOrderId: number;
  targetTableId: number;
  orderItemIds: number[];
  notes?: string;
}

export interface ConfirmCashPaymentRequest {
  orderId: number;
  amountGiven: number;
  customerPhone?: string;
}

export interface ConfirmCashPaymentResponse {
  success: boolean;
  orderId: number;
  orderNumber: string;
  totalAmount: number;
  amountGiven: number;
  changeAmount: number;
  loyaltyPointsEarned: number;
  newTotalLoyaltyPoints?: number;
  membershipTier?: string;
  message: string;
}

export interface VietQrResponse {
  orderId: number;
  orderNumber: string;
  amount: number;
  bankId: string;
  accountNumber: string;
  accountName: string;
  description: string;
  qrImageUrl: string;
  qrDataUrl: string;
}

export interface PosCustomer {
  id?: number;
  phoneNumber: string;
  fullName: string;
  membershipTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  loyaltyPoints: number;
  totalSpent: number;
  lastVisit?: string;
  notes?: string;
}

export interface TableOrderHistoryItem {
  id?: number;
  orderId?: number;
  orderNumber: string;
  completedAt?: string | null;
  createdAt?: string | null;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod?: string | null;
  cashierName?: string | null;
  customerName?: string | null;
  guestCount?: number;
  items?: Array<{
    orderItemId?: number;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    modifiersSummary?: string | null;
  }>;
}

export interface OrderReceiptDto {
  orderId?: number;
  orderNumber: string;
  tableName: string;
  cashierName: string;
  createdAt: string;
  completedAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  membershipTier?: string | null;
  items: Array<{
    itemName?: string;
    name?: string;
    quantity: number;
    unitPrice?: number;
    price?: number;
    totalPrice?: number;
    total?: number;
    modifiersSummary?: string | null;
    modifiers?: string | null;
  }>;
  subTotal: number;
  voucherCode?: string | null;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  amountGiven?: number | null;
  changeAmount?: number | null;
  remainingAmount: number;
  paymentMethod: string;
}

function normalizePosTable(raw: any): PosTable {
  const orderId = raw.currentOrderId ?? raw.activeOrderId ?? null;
  const total = Number(raw.totalAmount ?? raw.currentTotal ?? 0);
  const rawOpenedAt = raw.openedAt ? String(raw.openedAt) : null;
  const normalizedOpenedAt = rawOpenedAt
    ? rawOpenedAt.endsWith('Z') || rawOpenedAt.includes('+')
      ? rawOpenedAt
      : `${rawOpenedAt}Z`
    : null;
  return {
    tableId: raw.tableId ?? raw.id,
    tableNumber: raw.tableNumber || `BÀN ${raw.tableId}`,
    capacity: Number(raw.capacity ?? 4),
    minCapacity: Number(raw.minCapacity ?? 1),
    areaId: Number(raw.areaId ?? 0),
    areaName: raw.areaName || '',
    floor: raw.floor ?? null,
    status: raw.status || 'Empty',
    currentOrderId: orderId,
    activeOrderId: orderId,
    mergedIntoTableId: raw.mergedIntoTableId ?? null,
    guestCount: raw.guestCount,
    openedAt: normalizedOpenedAt,
    totalAmount: total,
    currentTotal: total,
    reservationTime: raw.reservationTime ?? null,
    sessionToken: raw.sessionToken || undefined,
    pinCode: raw.pinCode || undefined,
  };
}

export const posService = {
  // --- Table Operations ---
  async getTables(areaId?: number): Promise<PosTable[]> {
    const { data } = await apiClient.get<any[]>('/reservations/tables', {
      params: areaId ? { areaId } : undefined,
    });
    const list = Array.isArray(data) ? data : [];
    return list.map(normalizePosTable);
  },

  async getAreas(): Promise<PosArea[]> {
    const { data } = await apiClient.get('/reservations/areas');
    const list = Array.isArray(data) ? data : (data?.items || []);
    return list.map((a: any) => ({
      areaId: a.areaId || a.id || a.dbId,
      id: a.id || a.areaId || a.dbId,
      code: a.code || '',
      name: a.name || '',
      japaneseName: a.japaneseName || '',
      description: a.description || '',
      floor: a.floor ?? null,
      displayOrder: a.displayOrder ?? 0,
    }));
  },

  async openTable(tableId: number, guestCount = 2, notes?: string): Promise<OpenTableResponse> {
    const { data } = await apiClient.post<OpenTableResponse>(`/reservations/tables/${tableId}/open`, {
      guestCount,
      notes,
    });
    return data;
  },

  async regenerateTablePin(tableId: number): Promise<{ tableId: number; tableNumber: string; newPinCode: string; sessionToken: string; orderQrUrl: string }> {
    const { data } = await apiClient.post(`/reservations/tables/${tableId}/regenerate-pin`);
    return data;
  },

  async transferTable(sourceId: number, targetId: number): Promise<{ message: string }> {
    const { data } = await apiClient.post(`/reservations/tables/${sourceId}/transfer-to/${targetId}`);
    return data;
  },

  async mergeTables(masterId: number, secondaryId: number): Promise<{ message: string }> {
    const { data } = await apiClient.post(`/reservations/tables/${masterId}/merge/${secondaryId}`);
    return data;
  },

  async completeCleaning(tableId: number): Promise<void> {
    await apiClient.post(`/reservations/tables/${tableId}/complete-cleaning`);
  },

  async cancelEmptyTable(tableId: number): Promise<{ message: string }> {
    const { data } = await apiClient.post(`/reservations/tables/${tableId}/cancel-empty`);
    return data;
  },

  // --- Order, History, Receipt & Item Operations ---
  async getOrder(orderId: number): Promise<OrderDetailViewDto> {
    const { data } = await apiClient.get<OrderDetailViewDto>(`/orders/${orderId}`);
    return data;
  },

  async addItemsToOrder(request: AddItemToOrderRequest): Promise<OrderDetailViewDto> {
    const { data } = await apiClient.post<OrderDetailViewDto>('/orders/items', {
      ...request,
      sendDirectlyToKitchen: request.sendDirectlyToKitchen ?? true,
    });
    return data;
  },

  async cancelOrderItem(request: CancelOrderItemRequest): Promise<{ message: string }> {
    const { data } = await apiClient.post('/orders/items/cancel', request);
    return data;
  },

  async splitOrder(request: SplitOrderRequest): Promise<{ message: string }> {
    const { data } = await apiClient.post('/orders/split', request);
    return data;
  },

  async getTableOrderHistory(tableId: number, limit = 20): Promise<TableOrderHistoryItem[]> {
    const { data } = await apiClient.get<TableOrderHistoryItem[]>(`/orders/tables/${tableId}/history`, {
      params: { limit },
    });
    return Array.isArray(data) ? data : [];
  },

  async getOrderReceipt(orderId: number): Promise<OrderReceiptDto> {
    const { data } = await apiClient.get<OrderReceiptDto>(`/orders/${orderId}/receipt`);
    return data;
  },

  async applyOrderVoucher(orderId: number, voucherCode: string): Promise<OrderDetailViewDto> {
    const { data } = await apiClient.post<OrderDetailViewDto>(`/orders/${orderId}/apply-voucher`, {
      voucherCode,
    });
    return data;
  },

  async removeOrderVoucher(orderId: number): Promise<OrderDetailViewDto> {
    const { data } = await apiClient.delete<OrderDetailViewDto>(`/orders/${orderId}/voucher`);
    return data;
  },

  // --- Payment Operations ---
  async confirmCashPayment(request: ConfirmCashPaymentRequest): Promise<ConfirmCashPaymentResponse> {
    const { data } = await apiClient.post<ConfirmCashPaymentResponse>('/payments/cash-confirm', request);
    return data;
  },

  async getVietQr(orderId: number): Promise<VietQrResponse> {
    const { data } = await apiClient.get<VietQrResponse>(`/orders/${orderId}/vietqr`);
    return data;
  },

  async applyVoucher(
    code: string,
    currentSubtotal: number
  ): Promise<{ valid: boolean; discountAmount: number; message?: string }> {
    try {
      const { data } = await apiClient.post('/vouchers/apply', { code, currentSubtotal });
      return {
        valid: data?.isValid ?? true,
        discountAmount: Number(data?.discountAmount ?? 0),
        message: data?.message,
      };
    } catch (e: any) {
      return {
        valid: false,
        discountAmount: 0,
        message: e?.response?.data?.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.',
      };
    }
  },

  // --- Customer / Membership Operations (no localStorage/mock fallbacks) ---
  async lookupCustomer(phoneOrName: string): Promise<PosCustomer | null> {
    const clean = phoneOrName.trim();
    if (!clean) return null;
    try {
      const { data } = await apiClient.get<PosCustomer>('/user/lookup', { params: { query: clean } });
      return data;
    } catch {
      return null;
    }
  },

  async getCustomers(): Promise<PosCustomer[]> {
    try {
      const { data } = await apiClient.get('/admin/users', {
        params: { role: 'CUSTOMER', page: 1, pageSize: 50 },
      });
      const items = Array.isArray(data) ? data : (data?.items || []);
      return items.map((u: any) => ({
        id: u.id,
        phoneNumber: u.phoneNumber || '',
        fullName: u.fullName || '',
        membershipTier: u.membershipTier || 'BRONZE',
        loyaltyPoints: Number(u.loyaltyPoints ?? 0),
        totalSpent: Number(u.totalSpent ?? 0),
        lastVisit: u.lastLoginAt ? String(u.lastLoginAt).split('T')[0] : undefined,
      }));
    } catch {
      return [];
    }
  },

  async saveCustomer(customer: PosCustomer): Promise<PosCustomer> {
    if (customer.id) {
      const { data } = await apiClient.put<any>(`/admin/users/customers/${customer.id}`, {
        fullName: customer.fullName,
        phoneNumber: customer.phoneNumber,
        membershipTier: customer.membershipTier,
        loyaltyPoints: customer.loyaltyPoints,
      });
      return {
        ...customer,
        fullName: data?.fullName || customer.fullName,
        membershipTier: data?.membershipTier || customer.membershipTier,
        loyaltyPoints: Number(data?.loyaltyPoints ?? customer.loyaltyPoints),
      };
    } else {
      const safeEmail = customer.phoneNumber
        ? `${customer.phoneNumber.replace(/\D/g, '')}@japanfood.local`
        : `cust_${Date.now()}@japanfood.local`;
      const { data } = await apiClient.post<any>('/admin/users', {
        fullName: customer.fullName,
        phoneNumber: customer.phoneNumber,
        email: safeEmail,
        password: 'Customer@123456',
        role: 'CUSTOMER',
      });
      return {
        ...customer,
        id: data?.id,
        loyaltyPoints: data?.loyaltyPoints ?? 0,
        membershipTier: data?.membershipTier ?? 'BRONZE',
      };
    }
  },

  // --- WiFi & Dine-In QR Order Services ---
  async verifyTableNetwork(
    tableId: number,
    clientSsid: string,
    sessionToken?: string
  ): Promise<{ isAllowed: boolean; message: string; branchName?: string }> {
    const { data } = await apiClient.post('/reservations/tables/verify-network', {
      tableId,
      token: sessionToken,
      clientSsid,
    });
    return data;
  },

  // Buzz Kitchen (Giục Món) — gửi lên server, KDS nhận qua polling. Cooldown 3 phút/bàn do server kiểm soát.
  async buzzKitchen(
    tableId: number,
    sessionToken: string
  ): Promise<{ success: boolean; message: string; cooldownSeconds: number }> {
    try {
      const { data } = await apiClient.post<any>('/table-alerts/buzz', { tableId, token: sessionToken });
      return { success: true, message: data?.message || 'Đã gửi yêu cầu tới bếp!', cooldownSeconds: data?.cooldownSeconds ?? 180 };
    } catch (err: any) {
      const retry = Number(err?.response?.data?.retryAfterSeconds || 0);
      return { success: false, message: getErrorMessage(err), cooldownSeconds: retry };
    }
  },

  // Call Bill (Gọi tính tiền) — POS thu ngân nhận popup qua polling
  async callBill(
    tableId: number,
    sessionToken: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await apiClient.post<any>('/table-alerts/bill', { tableId, token: sessionToken });
      return { success: true, message: data?.message || 'Đã gửi yêu cầu thanh toán tới quầy thu ngân.' };
    } catch (err: any) {
      // 429 = đã gọi gần đây → vẫn coi là đã gửi
      if (err?.response?.status === 429) {
        return { success: true, message: err?.response?.data?.message || 'Yêu cầu tính tiền đã được gửi.' };
      }
      return { success: false, message: getErrorMessage(err) };
    }
  },

  // [POS/KDS] Polling thông báo bàn
  async getTableAlerts(afterId: number, type?: string): Promise<{ items: TableAlert[]; latestId: number }> {
    const { data } = await apiClient.get<any>('/table-alerts', { params: { afterId, type } });
    return { items: Array.isArray(data?.items) ? data.items : [], latestId: Number(data?.latestId || 0) };
  },

  async getPendingBillCalls(): Promise<TableAlert[]> {
    const { data } = await apiClient.get<TableAlert[]>('/table-alerts/pending-bills');
    return Array.isArray(data) ? data : [];
  },

  async acknowledgeTableAlert(id: number): Promise<void> {
    await apiClient.post(`/table-alerts/${id}/ack`);
  },
};

export interface TableAlert {
  id: number;
  type: 'KITCHEN_BUZZ' | 'BILL_CALL' | string;
  tableId: number;
  tableNumber: string;
  totalAmount: number;
  note?: string | null;
  createdAt: string;
  isAcknowledged: boolean;
  acknowledgedBy?: string | null;
}
