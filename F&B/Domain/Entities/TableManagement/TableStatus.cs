namespace Domain.Entities.TableManagement;

public enum TableStatus
{
    Empty = 1,       // Bàn trống, sẵn sàng đón khách
    Serving = 2,     // Đang phục vụ khách, có Order active
    Reserved = 3,    // Bàn đã được đặt trước
    Cleaning = 4     // Bàn đang chờ dọn dẹp vệ sinh
}
