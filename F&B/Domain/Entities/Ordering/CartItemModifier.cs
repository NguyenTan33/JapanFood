using Domain.Entities.Common;
using Domain.Entities.Menu;
using Domain.Exceptions;

namespace Domain.Entities.Ordering;

public class CartItemModifier : BaseEntity
{
    public int CartItemId { get; protected set; }
    public int ModifierOptionId { get; protected set; }
    public int Quantity { get; protected set; }

    public virtual CartItem? CartItem { get; protected set; }
    public virtual ModifierOption? ModifierOption { get; protected set; }

    protected CartItemModifier() { }

    public CartItemModifier(int cartItemId, int modifierOptionId, int quantity = 1)
    {
        if (modifierOptionId < 0)
            throw new BusinessException("Mã tùy chọn món không hợp lệ.");
        if (quantity <= 0)
            throw new BusinessException("Số lượng tùy chọn phải lớn hơn 0.");

        CartItemId = cartItemId;
        ModifierOptionId = modifierOptionId;
        Quantity = quantity;
    }

    public void UpdateQuantity(int quantity)
    {
        if (quantity <= 0)
            throw new BusinessException("Số lượng tùy chọn phải lớn hơn 0.");

        Quantity = quantity;
    }
}
