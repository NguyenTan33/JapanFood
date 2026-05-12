using Domain.Entities.Common;
using Domain.Entities.Kds;
using Domain.Exceptions;

namespace Domain.Entities.Menu;

public class OrderItem : BaseEntity
{
    public int OrderId { get; protected set; }
    public int MenuItemId { get; protected set; }
    public decimal UnitPrice { get; protected set; }
    public decimal ModifiersPrice { get; protected set; } = 0m;
    public int Quantity { get; protected set; }
    public decimal TotalPrice => (UnitPrice + ModifiersPrice) * Quantity;
    public OrderItemStatus ItemStatus { get; protected set; } = OrderItemStatus.Pending;
    public KitchenStationType KitchenStation { get; protected set; }
    public string? SpecialInstructions { get; protected set; }
    public string? CancellationReason { get; protected set; }
    public DateTime CreatedAt { get; protected set; } = DateTime.UtcNow;
    public DateTime? ServedAt { get; protected set; }

    public virtual Order Order { get; protected set; } = null!;
    public virtual MenuItem MenuItem { get; protected set; } = null!;

    private readonly List<OrderItemModifier> _modifiers = new();
    public virtual IReadOnlyCollection<OrderItemModifier> Modifiers => _modifiers.AsReadOnly();

    protected OrderItem() { }

    public OrderItem(
        int orderId,
        int menuItemId,
        decimal unitPrice,
        int quantity,
        KitchenStationType kitchenStation,
        string? specialInstructions = null)
    {
        if (quantity <= 0)
            throw new BusinessException("Số lượng món ăn phải lớn hơn 0.");
        if (unitPrice < 0)
            throw new BusinessException("Đơn giá món ăn không được âm.");

        OrderId = orderId;
        MenuItemId = menuItemId;
        UnitPrice = unitPrice;
        Quantity = quantity;
        KitchenStation = kitchenStation;
        SpecialInstructions = specialInstructions?.Trim();
        ItemStatus = OrderItemStatus.Pending;
        CreatedAt = DateTime.UtcNow;
    }

    public void AddModifier(ModifierOption option, int quantity)
    {
        ArgumentNullException.ThrowIfNull(option);
        if (quantity <= 0)
            throw new BusinessException("Số lượng modifier phải lớn hơn 0.");

        var mod = new OrderItemModifier(Id, option.Id, option.OptionName, option.PriceAdjustment, quantity);
        _modifiers.Add(mod);
        ModifiersPrice += option.PriceAdjustment * quantity;
    }

    public void IncreaseQuantity(int delta)
    {
        if (delta <= 0)
            throw new BusinessException("Số lượng tăng thêm phải lớn hơn 0.");
        Quantity += delta;
    }

    public void MarkSentToKitchen()
    {
        if (ItemStatus == OrderItemStatus.SentToKitchen || ItemStatus == OrderItemStatus.Cooking || ItemStatus == OrderItemStatus.Ready || ItemStatus == OrderItemStatus.Served)
            return;

        if (ItemStatus != OrderItemStatus.Pending)
            throw new BusinessException($"Chỉ có thể gửi bếp món ăn ở trạng thái Chờ (Pending). Trạng thái hiện tại: {ItemStatus}.");

        ItemStatus = OrderItemStatus.SentToKitchen;
    }

    public void MarkCooking()
    {
        if (ItemStatus == OrderItemStatus.Cooking || ItemStatus == OrderItemStatus.Ready || ItemStatus == OrderItemStatus.Served)
            return;

        if (ItemStatus != OrderItemStatus.SentToKitchen)
            throw new BusinessException($"Chỉ có thể bắt đầu nấu khi món đã gửi bếp. Trạng thái hiện tại: {ItemStatus}.");

        ItemStatus = OrderItemStatus.Cooking;
    }

    public void MarkReady()
    {
        if (ItemStatus == OrderItemStatus.Ready || ItemStatus == OrderItemStatus.Served)
            return;

        if (ItemStatus == OrderItemStatus.Cancelled)
            throw new BusinessException("Món ăn đã bị hủy, không thể báo xong.");

        ItemStatus = OrderItemStatus.Ready;
    }

    public void MarkServed()
    {
        if (ItemStatus == OrderItemStatus.Served)
            return;

        if (ItemStatus != OrderItemStatus.Ready && ItemStatus != OrderItemStatus.Cooking)
            throw new BusinessException($"Chỉ có thể phục vụ món ăn đã chế biến xong. Trạng thái hiện tại: {ItemStatus}.");

        ItemStatus = OrderItemStatus.Served;
        ServedAt = DateTime.UtcNow;
    }

    public void Cancel(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do hủy món không được để trống.");
        if (ItemStatus == OrderItemStatus.Served)
            throw new BusinessException("Món ăn đã được phục vụ ra bàn, không thể hủy.");

        ItemStatus = OrderItemStatus.Cancelled;
        CancellationReason = reason.Trim();
    }

    public void ReassignOrder(int newOrderId)
    {
        if (newOrderId <= 0)
            throw new BusinessException("Mã đơn hàng mới không hợp lệ.");

        OrderId = newOrderId;
    }
}
