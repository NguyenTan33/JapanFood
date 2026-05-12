namespace Domain.Entities.Menu;

public enum OrderStatus
{
    Pending = 1,             // Mới tạo, chờ xác nhận
    Confirmed = 2,           // Đã xác nhận
    InPreparation = 3,       // Đang nấu trong bếp (KDS)
    Served = 4,              // Đã lên món đủ cho khách
    Completed = 5,           // Đã thanh toán, hoàn tất
    Cancelled = 6,           // Hủy đơn
    ReadyForDispatch = 7     // Bếp đã nấu xong tất cả món, sẵn sàng đi đơn / trả khách
}

public enum OrderType
{
    DineIn = 1,              // Ăn tại quán
    Takeaway = 2,            // Mang đi
    Delivery = 3             // Giao hàng
}
