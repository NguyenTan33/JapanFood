using Domain.Entities.Menu;

namespace Application.DTOs.Ordering;

public class AddOrderItemsRequestDto
{
    public int OrderId { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = new();
    public bool SendDirectlyToKitchen { get; set; } = true;
}

public class CancelOrderItemRequestDto
{
    public int OrderId { get; set; }
    public int OrderItemId { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class SplitOrderRequestDto
{
    public int SourceOrderId { get; set; }
    public int TargetTableId { get; set; }
    public List<int> OrderItemIds { get; set; } = new();
    public string? Notes { get; set; }
}

public class ApproveOnlineOrderRequestDto
{
    public int OrderId { get; set; }
    public int EstimatedPrepMinutes { get; set; } = 20;
}

public class DispatchOnlineOrderRequestDto
{
    public int OrderId { get; set; }
    public string? ShipperName { get; set; }
    public string? ShipperPhone { get; set; }
}

public class OnlinePendingOrderDto
{
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public OrderType OrderType { get; set; }
    public string OrderTypeName { get; set; } = string.Empty;
    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public string? DeliveryAddress { get; set; }
    public decimal TotalAmount { get; set; }
    public int TotalItems { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<string> ItemsSummary { get; set; } = new();
}
