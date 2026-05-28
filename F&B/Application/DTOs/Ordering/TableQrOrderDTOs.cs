namespace Application.DTOs.Ordering;

public class TableQrOrderRequestDto
{
    public int TableId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string? PinCode { get; set; }
    public string? ClientSsid { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = new();
    public string? Notes { get; set; }
}

public class TableQrOrderResponseDto
{
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string TableNumber { get; set; } = string.Empty;
    public int ItemsCount { get; set; }
    public decimal SubTotal { get; set; }
    public decimal TotalAmount { get; set; }
    public bool SentDirectlyToKitchen { get; set; } = true;
    public string Message { get; set; } = string.Empty;
}

public class TableQrSessionResponseDto
{
    public int TableId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public string AreaName { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? CurrentOrderId { get; set; }
    public string? OrderNumber { get; set; }
    public DateTime? OpenedAt { get; set; }
    public decimal SubTotal { get; set; }
    public decimal TotalAmount { get; set; }
    public List<TableQrOrderedItemDto> Items { get; set; } = new();
    public List<string> ActiveSsids { get; set; } = new();
    public bool IsWifiValid { get; set; } = true;
    public bool RequiresPin { get; set; } = false;
    public bool IsPinVerified { get; set; } = false;
}

public class TableQrOrderedItemDto
{
    public int Id { get; set; }
    public int MenuItemId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public decimal Total { get; set; }
    public string Status { get; set; } = "Pending";
    public string? Modifiers { get; set; }
    public string? SpecialInstructions { get; set; }
    public DateTime? CreatedAt { get; set; }
}
