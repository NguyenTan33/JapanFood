using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Kds;

public class KitchenTicketItem : BaseEntity
{
    public int TicketId { get; protected set; }
    public int OrderItemId { get; protected set; }
    public int StationId { get; protected set; }
    public string MenuItemName { get; protected set; } = string.Empty;
    public int Quantity { get; protected set; }
    public string? ModifiersSummary { get; protected set; }
    public KitchenItemStatus Status { get; protected set; } = KitchenItemStatus.Pending;
    public DateTime? CookingStartTime { get; protected set; }
    public DateTime? ReadyTime { get; protected set; }
    public DateTime? ServedTime { get; protected set; }
    public int? CookUserId { get; protected set; }
    public string? CancellationReason { get; protected set; }

    public virtual KitchenTicket? Ticket { get; protected set; }
    public virtual KitchenStation? Station { get; protected set; }
    public virtual User? CookUser { get; protected set; }

    protected KitchenTicketItem() { }

    public KitchenTicketItem(int ticketId, int orderItemId, int stationId, string menuItemName, int quantity, string? modifiersSummary)
    {
        if (orderItemId <= 0)
            throw new BusinessException("Mã món trong đơn hàng không hợp lệ.");
        if (stationId <= 0)
            throw new BusinessException("Mã trạm bếp không hợp lệ.");
        if (string.IsNullOrWhiteSpace(menuItemName))
            throw new BusinessException("Tên món ăn không được để trống.");
        if (quantity <= 0)
            throw new BusinessException("Số lượng phải lớn hơn 0.");

        TicketId = ticketId;
        OrderItemId = orderItemId;
        StationId = stationId;
        MenuItemName = menuItemName.Trim();
        Quantity = quantity;
        ModifiersSummary = modifiersSummary?.Trim();
        Status = KitchenItemStatus.Pending;
    }

    public void UpdateQuantity(int newQuantity)
    {
        if (newQuantity <= 0)
            throw new BusinessException("Số lượng phải lớn hơn 0.");
        Quantity = newQuantity;
    }

    public void IncreaseQuantity(int delta)
    {
        if (delta <= 0)
            throw new BusinessException("Số lượng tăng thêm phải lớn hơn 0.");
        Quantity += delta;
    }

    public void StartCooking(int cookUserId)
    {
        if (Status != KitchenItemStatus.Pending)
            throw new BusinessException($"Không thể bắt đầu nấu món ở trạng thái '{Status}'. Chỉ món ở trạng thái Chờ (Pending) mới có thể nấu.");
        if (cookUserId <= 0)
            throw new BusinessException("Mã đầu bếp không hợp lệ.");

        Status = KitchenItemStatus.Cooking;
        CookingStartTime = DateTime.UtcNow;
        CookUserId = cookUserId;
    }

    public void MarkReady()
    {
        if (Status == KitchenItemStatus.Ready || Status == KitchenItemStatus.Served)
            return;

        if (Status != KitchenItemStatus.Cooking)
            throw new BusinessException($"Không thể báo xong món ở trạng thái '{Status}'. Món phải đang được nấu (Cooking).");
        if (!CookingStartTime.HasValue)
            CookingStartTime = DateTime.UtcNow;

        Status = KitchenItemStatus.Ready;
        ReadyTime = DateTime.UtcNow;
    }

    public void MarkServed()
    {
        if (Status == KitchenItemStatus.Served)
            return;

        if (Status != KitchenItemStatus.Ready)
            throw new BusinessException($"Không thể báo đã phục vụ từ trạng thái '{Status}'. Món phải ở trạng thái Đã nấu xong (Ready).");
        if (!ReadyTime.HasValue)
            ReadyTime = DateTime.UtcNow;

        Status = KitchenItemStatus.Served;
        ServedTime = DateTime.UtcNow;
    }

    public void Cancel(string reason)
    {
        if (Status == KitchenItemStatus.Served)
            throw new BusinessException("Không thể hủy món ăn đã phục vụ cho khách.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do hủy món là bắt buộc.");

        Status = KitchenItemStatus.Cancelled;
        CancellationReason = reason.Trim();
    }

    public void ReassignStation(int newStationId)
    {
        if (Status != KitchenItemStatus.Pending)
            throw new BusinessException($"Không thể đổi trạm bếp khi món đã ở trạng thái '{Status}'.");
        if (newStationId <= 0)
            throw new BusinessException("Mã trạm bếp mới không hợp lệ.");

        StationId = newStationId;
    }
}
