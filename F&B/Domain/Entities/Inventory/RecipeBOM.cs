using Domain.Entities.Common;
using Domain.Entities.Menu;
using Domain.Exceptions;

namespace Domain.Entities.Inventory;

public class RecipeBOM : BaseEntity
{
    public int MenuItemId { get; protected set; }
    public int InventoryItemId { get; protected set; }
    public decimal QuantityRequired { get; protected set; }
    public int UomId { get; protected set; }
    public decimal WastagePercentage { get; protected set; } = 0;
    public string? PreparationNotes { get; protected set; }

    public virtual MenuItem? MenuItem { get; protected set; }
    public virtual InventoryItem? InventoryItem { get; protected set; }
    public virtual UnitOfMeasure? Uom { get; protected set; }

    protected RecipeBOM() { }

    public RecipeBOM(int menuItemId, int inventoryItemId, decimal quantityRequired, int uomId, decimal wastagePercentage = 0, string? preparationNotes = null)
    {
        if (menuItemId <= 0)
            throw new BusinessException("Mã món ăn không hợp lệ.");
        if (inventoryItemId <= 0)
            throw new BusinessException("Mã nguyên liệu không hợp lệ.");
        if (quantityRequired <= 0)
            throw new BusinessException("Định lượng nguyên liệu phải lớn hơn 0.");
        if (uomId <= 0)
            throw new BusinessException("Mã đơn vị tính không hợp lệ.");
        if (wastagePercentage < 0 || wastagePercentage > 100)
            throw new BusinessException("Tỷ lệ hao hụt phải từ 0% đến 100%.");

        MenuItemId = menuItemId;
        InventoryItemId = inventoryItemId;
        QuantityRequired = quantityRequired;
        UomId = uomId;
        WastagePercentage = wastagePercentage;
        PreparationNotes = preparationNotes?.Trim();
    }

    public decimal CalculateGrossRequirement() => Math.Round(QuantityRequired * (1 + (WastagePercentage / 100m)), 4);

    public void UpdateQuantity(decimal quantityRequired, decimal wastagePercentage)
    {
        if (quantityRequired <= 0)
            throw new BusinessException("Định lượng nguyên liệu phải lớn hơn 0.");
        if (wastagePercentage < 0 || wastagePercentage > 100)
            throw new BusinessException("Tỷ lệ hao hụt phải từ 0% đến 100%.");

        QuantityRequired = quantityRequired;
        WastagePercentage = wastagePercentage;
    }
}
