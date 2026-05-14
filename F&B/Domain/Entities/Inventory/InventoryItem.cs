using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Inventory;

public class InventoryItem : BaseAuditableEntity
{
    public string Sku { get; protected set; } = string.Empty;
    public string Name { get; protected set; } = string.Empty;
    public string Category { get; protected set; } = string.Empty;
    public int PrimaryUomId { get; protected set; }
    public decimal CurrentStock { get; protected set; } = 0;
    public decimal MinimumStock { get; protected set; } = 0;
    public decimal UnitCost { get; protected set; } = 0;
    public string? StorageLocation { get; protected set; }
    public bool IsActive { get; protected set; } = true;

    public virtual UnitOfMeasure? PrimaryUom { get; protected set; }
    private readonly List<RecipeBOM> _recipes = new();
    public virtual IReadOnlyCollection<RecipeBOM> Recipes => _recipes.AsReadOnly();

    protected InventoryItem() { }

    public InventoryItem(string sku, string name, string category, int primaryUomId, decimal minimumStock = 0, decimal unitCost = 0, string? storageLocation = null)
    {
        if (string.IsNullOrWhiteSpace(sku))
            throw new BusinessException("Mã SKU nguyên liệu không được để trống.");
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên nguyên liệu không được để trống.");
        if (string.IsNullOrWhiteSpace(category))
            throw new BusinessException("Nhóm nguyên liệu không được để trống.");
        if (primaryUomId <= 0)
            throw new BusinessException("Mã đơn vị tính chính không hợp lệ.");
        if (minimumStock < 0)
            throw new BusinessException("Mức tồn kho tối thiểu không được âm.");
        if (unitCost < 0)
            throw new BusinessException("Đơn giá vốn không được âm.");

        Sku = sku.Trim().ToUpperInvariant();
        Name = name.Trim();
        Category = category.Trim();
        PrimaryUomId = primaryUomId;
        CurrentStock = 0;
        MinimumStock = minimumStock;
        UnitCost = unitCost;
        StorageLocation = storageLocation?.Trim();
        IsActive = true;
    }

    public void DeductStock(decimal quantity, string reason)
    {
        if (quantity <= 0)
            throw new BusinessException("Số lượng xuất kho phải lớn hơn 0.");
        if (CurrentStock - quantity < 0)
            throw new BusinessException($"Tồn kho không đủ cho '{Name}' (SKU: {Sku}). Hiện có: {CurrentStock}, Yêu cầu xuất: {quantity}.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do xuất kho không được để trống.");

        CurrentStock -= quantity;
    }

    public void AddStock(decimal quantity, decimal unitCost, string reason)
    {
        if (quantity <= 0)
            throw new BusinessException("Số lượng nhập kho phải lớn hơn 0.");
        if (unitCost < 0)
            throw new BusinessException("Đơn giá nhập không được âm.");

        // Weighted moving average unit cost
        decimal totalValue = (CurrentStock * UnitCost) + (quantity * unitCost);
        CurrentStock += quantity;
        UnitCost = CurrentStock > 0 ? Math.Round(totalValue / CurrentStock, 2) : unitCost;
    }

    public void AdjustStock(decimal newStock, string reason)
    {
        if (newStock < 0)
            throw new BusinessException("Tồn kho sau điều chỉnh không được âm.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do điều chỉnh kho không được để trống.");

        CurrentStock = newStock;
    }

    public void UpdateThresholds(decimal minimumStock, string? storageLocation)
    {
        if (minimumStock < 0)
            throw new BusinessException("Mức tồn kho tối thiểu không được âm.");

        MinimumStock = minimumStock;
        StorageLocation = storageLocation?.Trim();
    }

    public void UpdateDetails(string name, string category, int? primaryUomId, decimal minimumStock, decimal unitCost, string? storageLocation)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên nguyên liệu không được để trống.");
        if (string.IsNullOrWhiteSpace(category))
            throw new BusinessException("Nhóm nguyên liệu không được để trống.");
        if (minimumStock < 0)
            throw new BusinessException("Mức tồn kho tối thiểu không được âm.");
        if (unitCost < 0)
            throw new BusinessException("Đơn giá vốn không được âm.");

        Name = name.Trim();
        Category = category.Trim();
        if (primaryUomId.HasValue && primaryUomId.Value > 0)
            PrimaryUomId = primaryUomId.Value;
        MinimumStock = minimumStock;
        UnitCost = unitCost;
        StorageLocation = storageLocation?.Trim();
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
