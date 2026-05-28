using Domain.Entities.Menu;

namespace Application.DTOs.Ordering;

public class OrderDetailViewDto
{
    public int OrderId { get; set; }
    public int? UserId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string OrderType { get; set; } = string.Empty;
    public int GuestCount { get; set; }
    public decimal SubTotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal DepositRate { get; set; } = 1.0m;
    public decimal DepositAmount { get; set; }
    public decimal RemainingCodAmount { get; set; }
    public string? PaymentMethod { get; set; }
    public string? DeliveryAddress { get; set; }
    public string? RecipientName { get; set; }
    public string? RecipientPhone { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? TableNumber { get; set; }
    public string? AreaName { get; set; }
    public string? VoucherCode { get; set; }
    public bool IsReviewed { get; set; }
    public List<OrderItemViewDto> Items { get; set; } = new();
    public List<PaymentTransactionViewDto> PaymentTransactions { get; set; } = new();
}

public class OrderItemViewDto
{
    public int OrderItemId { get; set; }
    public int MenuItemId { get; set; }
    public string DishCode { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal ModifiersPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public string ItemStatus { get; set; } = string.Empty;
    public string? SpecialInstructions { get; set; }
    public List<OrderItemModifierViewDto> Modifiers { get; set; } = new();
}

public class OrderItemModifierViewDto
{
    public string ModifierOptionName { get; set; } = string.Empty;
    public decimal PriceAdjustment { get; set; }
    public int Quantity { get; set; }
}

public class PaymentTransactionViewDto
{
    public string TransactionNumber { get; set; } = string.Empty;
    public string Gateway { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? GatewayTransactionId { get; set; }
    public DateTime? PaidAt { get; set; }
}

public class CreateOrderRequestDto
{
    public OrderType OrderType { get; set; } = OrderType.DineIn;
    public int? TableId { get; set; }
    public int? UserId { get; set; }
    public int? ReservationId { get; set; }
    public int GuestCount { get; set; } = 1;
    public string? DeliveryAddress { get; set; }
    public string? RecipientName { get; set; }
    public string? RecipientPhone { get; set; }
    public OrderPaymentMethod? PaymentMethod { get; set; }
    public string? Notes { get; set; }
    public string? VoucherCode { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = new();
}

public class CreateOrderItemDto
{
    public int MenuItemId { get; set; }
    public int Quantity { get; set; } = 1;
    public string? SpecialInstructions { get; set; }
    public List<int> ModifierOptionIds { get; set; } = new();
}

public class RevenueReportPointDto
{
    public DateTime Date { get; set; }
    public int TotalOrders { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalTax { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal NetSales { get; set; }
}

public class TopDishReportDto
{
    public int MenuItemId { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public int TotalQuantitySold { get; set; }
    public decimal TotalRevenue { get; set; }
}

public class DetailedRevenueReportDto
{
    public decimal TotalRevenue { get; set; }
    public decimal NetSales { get; set; }
    public decimal TotalTax { get; set; }
    public decimal TotalDiscount { get; set; }
    public int TotalOrders { get; set; }
    public int TotalDishesSold { get; set; }
    public decimal CashRevenue { get; set; }
    public decimal TransferRevenue { get; set; }
    public List<RevenueReportPointDto> ChartPoints { get; set; } = new();
    public List<SoldDishItemReportDto> SoldItems { get; set; } = new();
    public List<TopDishReportDto> TopDishes { get; set; } = new();
}

public class SoldDishItemReportDto
{
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string? TableNumber { get; set; }
    public int MenuItemId { get; set; }
    public string DishName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public string? ModifiersSummary { get; set; }
    public DateTime CompletedAt { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
}
