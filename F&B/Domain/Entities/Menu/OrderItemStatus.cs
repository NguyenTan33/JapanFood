namespace Domain.Entities.Menu;

public enum OrderItemStatus
{
    Pending = 1,             // Chờ gửi bếp
    SentToKitchen = 2,       // Đã gửi bếp
    Cooking = 3,             // Đang chế biến
    Ready = 4,               // Đã chế biến xong, chờ phục vụ
    Served = 5,              // Đã phục vụ ra bàn
    Cancelled = 6            // Hủy món
}
