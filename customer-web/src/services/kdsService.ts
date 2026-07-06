import { apiClient } from './apiClient';

export type KdsTab = 'unfinished' | 'completed' | 'cancelled';

export interface KitchenItemCardDto {
  ticketItemId: number;
  ticketId: number;
  orderId: number;
  orderNumber: string; // Retained in DTO for API compatibility; never rendered on KDS cards
  tableId: number | null;
  tableName: string;
  menuItemId: number;
  dishName: string;
  quantity: number;
  modifiersSummary?: string | null;
  specialInstructions?: string | null;
  status: 'Pending' | 'Cooking' | 'Ready' | 'Served' | 'Cancelled' | string;
  createdAt: string;
  completedAt?: string | null;
  completedTimeDisplay?: string | null;
  elapsedMinutes: number;
  isOverdue: boolean;
  cancellationReason?: string | null;
  printCount: number;
  lastPrintedAt?: string | null;
}

export interface KitchenTabCountsDto {
  unfinished: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

export interface KitchenItemsResponseDto {
  counts: KitchenTabCountsDto;
  items: KitchenItemCardDto[];
}

export interface KdsPrintTicketDto {
  restaurantName: string;
  tableName: string;
  dishName: string;
  quantity: number;
  modifiersSummary?: string | null;
  specialInstructions?: string | null;
  orderedAtDisplay: string;
  completedAtDisplay: string;
  copyNumber: number;
  escPosBase64?: string | null;
}

export interface CompleteOrReprintResponseDto {
  item: KitchenItemCardDto;
  printTicket: KdsPrintTicketDto;
}

export const kdsService = {
  async getItems(params: {
    tab: KdsTab;
    tableId?: number;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<KitchenItemsResponseDto> {
    const query: Record<string, string | number> = { tab: params.tab };
    if (params.tableId !== undefined) query.tableId = params.tableId;
    if (params.search && params.search.trim()) query.search = params.search.trim();
    if (params.fromDate) query.fromDate = params.fromDate;
    if (params.toDate) query.toDate = params.toDate;

    const { data } = await apiClient.get<KitchenItemsResponseDto>('/kitchen/items', {
      params: query,
    });
    return {
      counts: data?.counts ?? { unfinished: 0, completed: 0, cancelled: 0, overdue: 0 },
      items: Array.isArray(data?.items) ? data.items : [],
    };
  },

  async completeItem(ticketItemId: number): Promise<CompleteOrReprintResponseDto> {
    const { data } = await apiClient.post<CompleteOrReprintResponseDto>(
      `/kitchen/items/${ticketItemId}/complete`
    );
    return data;
  },

  async reprintItem(ticketItemId: number): Promise<CompleteOrReprintResponseDto> {
    const { data } = await apiClient.post<CompleteOrReprintResponseDto>(
      `/kitchen/items/${ticketItemId}/reprint`
    );
    return data;
  },
};
