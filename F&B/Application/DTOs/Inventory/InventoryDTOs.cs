namespace Application.DTOs.Inventory;

public class RestockItemRequestDto
{
    public int InventoryItemId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class DeductStockRequestDto
{
    public int InventoryItemId { get; set; }
    public decimal Quantity { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class InventoryItemDto
{
    public int Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int PrimaryUomId { get; set; }
    public string? PrimaryUomName { get; set; }
    public decimal CurrentStock { get; set; }
    public decimal MinimumStock { get; set; }
    public decimal UnitCost { get; set; }
    public string? StorageLocation { get; set; }
    public bool IsActive { get; set; }
}

public class UnitOfMeasureDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class CreateInventoryItemRequestDto
{
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int PrimaryUomId { get; set; } = 1;
    public decimal InitialStock { get; set; }
    public decimal MinimumStock { get; set; }
    public decimal UnitCost { get; set; }
    public string? StorageLocation { get; set; }
}

public class UpdateInventoryItemRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int? PrimaryUomId { get; set; }
    public decimal? CurrentStock { get; set; }
    public decimal MinimumStock { get; set; }
    public decimal UnitCost { get; set; }
    public string? StorageLocation { get; set; }
    public bool? IsActive { get; set; }
}
