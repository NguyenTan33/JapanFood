namespace Domain.Entities.Kds;

public enum KitchenItemStatus
{
    Pending = 1,      // Đang chờ trạm nhận
    Cooking = 2,      // Đang nấu / chế biến
    Ready = 3,        // Đã hoàn thành, chờ bưng
    Served = 4,       // Đã bưng ra bàn
    Cancelled = 5     // Đã hủy món
}

public enum KitchenTicketStatus
{
    Pending = 1,
    Cooking = 2,
    Ready = 3,
    Served = 4,
    Cancelled = 5
}
