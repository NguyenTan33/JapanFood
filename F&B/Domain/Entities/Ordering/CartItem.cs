using Domain.Entities.Common;
using Domain.Entities.Menu;
using Domain.Exceptions;

namespace Domain.Entities.Ordering;

public class CartItem : BaseAuditableEntity
{
    public int UserId { get; protected set; }
    public int MenuItemId { get; protected set; }
    public int Quantity { get; protected set; }
    public string? SpecialInstructions { get; protected set; }

    public virtual User? User { get; protected set; }
    public virtual MenuItem? MenuItem { get; protected set; }

    private readonly List<CartItemModifier> _modifiers = new();
    public virtual IReadOnlyCollection<CartItemModifier> Modifiers => _modifiers.AsReadOnly();

    protected CartItem() { }

    public CartItem(int userId, int menuItemId, int quantity = 1, string? specialInstructions = null)
    {
        if (userId <= 0)
            throw new BusinessException("Mã người dùng không hợp lệ.");
        if (menuItemId <= 0)
            throw new BusinessException("Mã món ăn không hợp lệ.");
        if (quantity <= 0)
            throw new BusinessException("Số lượng món ăn phải lớn hơn 0.");
        if (quantity > 50)
            throw new BusinessException("Số lượng món trong giỏ hàng không được vượt quá 50.");

        UserId = userId;
        MenuItemId = menuItemId;
        Quantity = quantity;
        SpecialInstructions = specialInstructions?.Trim();
    }

    public void UpdateQuantity(int quantity)
    {
        if (quantity <= 0)
            throw new BusinessException("Số lượng món ăn trong giỏ hàng phải lớn hơn 0.");
        if (quantity > 50)
            throw new BusinessException("Số lượng món trong giỏ hàng không được vượt quá 50.");

        Quantity = quantity;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddModifier(ModifierOption option, int quantity = 1)
    {
        ArgumentNullException.ThrowIfNull(option);
        if (quantity <= 0)
            throw new BusinessException("Số lượng tùy chọn phải lớn hơn 0.");

        var existing = _modifiers.FirstOrDefault(m => m.ModifierOptionId == option.Id);
        if (existing != null)
        {
            existing.UpdateQuantity(existing.Quantity + quantity);
        }
        else
        {
            _modifiers.Add(new CartItemModifier(Id, option.Id, quantity));
        }

        UpdatedAt = DateTime.UtcNow;
    }

    public void ClearModifiers()
    {
        _modifiers.Clear();
        UpdatedAt = DateTime.UtcNow;
    }
}
