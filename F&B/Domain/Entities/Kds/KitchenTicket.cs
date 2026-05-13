using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Kds;

public class KitchenTicket : BaseEntity
{
    public int OrderId { get; protected set; }
    public string TicketNumber { get; protected set; } = string.Empty;
    public string TableName { get; protected set; } = string.Empty;
    public KitchenTicketStatus Status { get; protected set; } = KitchenTicketStatus.Pending;
    public bool IsRush { get; protected set; } = false;
    public string? Notes { get; protected set; }
    public DateTime CreatedAt { get; protected set; } = DateTime.UtcNow;
    public DateTime? ReadyAt { get; protected set; }
    public DateTime? ServedAt { get; protected set; }

    private readonly List<KitchenTicketItem> _items = new();
    public virtual IReadOnlyCollection<KitchenTicketItem> Items => _items.AsReadOnly();

    protected KitchenTicket() { }

    public KitchenTicket(int orderId, string ticketNumber, string tableName, string? notes = null, bool isRush = false)
    {
        if (orderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ cho phiếu bếp.");
        if (string.IsNullOrWhiteSpace(ticketNumber))
            throw new BusinessException("Mã phiếu bếp không được để trống.");
        if (string.IsNullOrWhiteSpace(tableName))
            throw new BusinessException("Tên bàn không được để trống.");

        OrderId = orderId;
        TicketNumber = ticketNumber.Trim().ToUpperInvariant();
        TableName = tableName.Trim();
        Notes = notes?.Trim();
        IsRush = isRush;
        Status = KitchenTicketStatus.Pending;
        CreatedAt = DateTime.UtcNow;
    }

    public KitchenTicketItem AddItem(int orderItemId, int stationId, string menuItemName, int quantity, string? modifiersSummary)
    {
        if (Status == KitchenTicketStatus.Served || Status == KitchenTicketStatus.Cancelled)
            throw new BusinessException($"Không thể thêm món vào phiếu bếp đã ở trạng thái {Status}.");

        var item = new KitchenTicketItem(Id, orderItemId, stationId, menuItemName, quantity, modifiersSummary);
        _items.Add(item);
        return item;
    }

    public void MarkRush(bool isRush) => IsRush = isRush;

    public void SyncStatusFromItems()
    {
        if (!_items.Any()) return;

        if (_items.All(i => i.Status == KitchenItemStatus.Served || i.Status == KitchenItemStatus.Cancelled))
        {
            Status = KitchenTicketStatus.Served;
            ServedAt = DateTime.UtcNow;
        }
        else if (_items.Where(i => i.Status != KitchenItemStatus.Cancelled).All(i => i.Status == KitchenItemStatus.Ready || i.Status == KitchenItemStatus.Served))
        {
            Status = KitchenTicketStatus.Ready;
            ReadyAt ??= DateTime.UtcNow;
        }
        else if (_items.Any(i => i.Status == KitchenItemStatus.Cooking))
        {
            Status = KitchenTicketStatus.Cooking;
        }
    }

    public void CancelTicket(string reason)
    {
        if (Status == KitchenTicketStatus.Served)
            throw new BusinessException("Không thể hủy phiếu bếp đã phục vụ hoàn tất.");

        Status = KitchenTicketStatus.Cancelled;
        foreach (var item in _items.Where(i => i.Status != KitchenItemStatus.Served))
        {
            item.Cancel(reason);
        }
    }
}
