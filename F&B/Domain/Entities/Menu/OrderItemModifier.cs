using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Menu;

public class OrderItemModifier : BaseEntity
{
    public int OrderItemId { get; protected set; }
    public int ModifierOptionId { get; protected set; }
    public string ModifierOptionName { get; protected set; } = string.Empty;
    public decimal PriceAdjustment { get; protected set; }
    public int Quantity { get; protected set; } = 1;

    public virtual OrderItem OrderItem { get; protected set; } = null!;
    public virtual ModifierOption ModifierOption { get; protected set; } = null!;

    protected OrderItemModifier() { }

    public OrderItemModifier(int orderItemId, int modifierOptionId, string modifierOptionName, decimal priceAdjustment, int quantity = 1)
    {
        if (string.IsNullOrWhiteSpace(modifierOptionName))
            throw new BusinessException("Tên tùy chọn không được để trống.");
        if (priceAdjustment < 0)
            throw new BusinessException("Phụ thu không được âm.");
        if (quantity <= 0)
            throw new BusinessException("Số lượng tùy chọn phải lớn hơn 0.");

        OrderItemId = orderItemId;
        ModifierOptionId = modifierOptionId;
        ModifierOptionName = modifierOptionName.Trim();
        PriceAdjustment = priceAdjustment;
        Quantity = quantity;
    }
}
