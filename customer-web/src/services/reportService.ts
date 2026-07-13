import { apiClient } from './apiClient';

export interface RevenueReportPoint {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  netSales: number;
}

export interface SoldDishItemReport {
  orderId: number;
  orderNumber: string;
  tableNumber?: string;
  menuItemId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiersSummary?: string;
  completedAt: string;
  paymentMethod: string;
}

export interface TopDishReport {
  menuItemId: number;
  itemCode: string;
  itemName: string;
  imageUrl?: string;
  totalQuantitySold: number;
  totalRevenue: number;
}

export interface DetailedRevenueReport {
  totalRevenue: number;
  netSales: number;
  totalTax: number;
  totalDiscount: number;
  totalOrders: number;
  totalDishesSold: number;
  cashRevenue: number;
  transferRevenue: number;
  chartPoints: RevenueReportPoint[];
  soldItems: SoldDishItemReport[];
  topDishes: TopDishReport[];
}

export interface DetailedReportFilter {
  fromDate?: string;
  toDate?: string;
  year?: number;
  month?: number;
  tableId?: number;
  menuItemId?: number;
  categoryId?: number;
}

export const reportService = {
  async getDetailedReport(filter?: DetailedReportFilter): Promise<DetailedRevenueReport> {
    const { data } = await apiClient.get<DetailedRevenueReport>('/reports/detailed', { params: filter });
    return data;
  },

  async getRevenueReport(fromDate?: string, toDate?: string): Promise<RevenueReportPoint[]> {
    const { data } = await apiClient.get<RevenueReportPoint[]>('/reports/revenue', {
      params: { fromDate, toDate },
    });
    return data;
  },

  async getTopDishes(topCount = 10, fromDate?: string, toDate?: string): Promise<TopDishReport[]> {
    const { data } = await apiClient.get<TopDishReport[]>('/reports/top-dishes', {
      params: { topCount, fromDate, toDate },
    });
    return data;
  },
};
