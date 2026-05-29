namespace Application.DTOs.Kds;

public class KitchenTicketDto
{
    public int TicketId { get; set; }
    public string TicketNumber { get; set; } = string.Empty;
    public string TableName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool IsRush { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public double ElapsedMinutes { get; set; }
    public bool HasOverdueItems { get; set; }
    public List<KitchenTicketItemDto> Items { get; set; } = new();
}

public class KitchenTicketItemDto
{
    public int TicketItemId { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ModifiersSummary { get; set; }
    public string? SpecialInstructions { get; set; }
    public DateTime? CookingStartTime { get; set; }
    public double ElapsedMinutes { get; set; }
    public bool IsOverdue { get; set; }
    public string WarningColor { get; set; } = "NORMAL"; // NORMAL, WARNING_YELLOW, OVERDUE_RED
}

public class OverdueKitchenAlertDto
{
    public int TicketItemId { get; set; }
    public string TicketNumber { get; set; } = string.Empty;
    public int? TableId { get; set; }
    public string TableName { get; set; } = string.Empty;
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string MenuItemName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public int StationId { get; set; }
    public string StationName { get; set; } = string.Empty;
    public double ElapsedMinutes { get; set; }
    public string Status { get; set; } = string.Empty;
    public string AlertMessage { get; set; } = string.Empty;
}

public class KitchenItemCardDto
{
    public int TicketItemId { get; set; }
    public int TicketId { get; set; }
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public int? TableId { get; set; }
    public string TableName { get; set; } = string.Empty;
    public int MenuItemId { get; set; }
    public string DishName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string? ModifiersSummary { get; set; }
    public string? SpecialInstructions { get; set; }
    public string Status { get; set; } = string.Empty; // Pending, Cooking, Ready, Served, Cancelled
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? CompletedTimeDisplay { get; set; }
    public double ElapsedMinutes { get; set; }
    public bool IsOverdue { get; set; }
    public string? CancellationReason { get; set; }
    public int PrintCount { get; set; } = 1;
    public DateTime? LastPrintedAt { get; set; }
}

public class KitchenTabCountsDto
{
    public int Unfinished { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int Overdue { get; set; }
}

public class KitchenItemsResponseDto
{
    public KitchenTabCountsDto Counts { get; set; } = new();
    public List<KitchenItemCardDto> Items { get; set; } = new();
}

public class KdsPrintTicketDto
{
    public string RestaurantName { get; set; } = "Sakura Japan Food";
    public string TableName { get; set; } = string.Empty;
    public string DishName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string? ModifiersSummary { get; set; }
    public string? SpecialInstructions { get; set; }
    public string OrderedAtDisplay { get; set; } = string.Empty;
    public string CompletedAtDisplay { get; set; } = string.Empty;
    public int CopyNumber { get; set; } = 1;
    public string? EscPosBase64 { get; set; }
}

public class CompleteOrReprintResponseDto
{
    public KitchenItemCardDto Item { get; set; } = new();
    public KdsPrintTicketDto PrintTicket { get; set; } = new();
}
