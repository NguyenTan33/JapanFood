namespace Domain.Entities.Operations;

public enum ShiftType
{
    MorningOpening = 1,       // Mở ca sáng (Nước dùng, nhiệt độ tủ đông/mát, quầy Yatai)
    ShiftHandover = 2,        // Giao ca (Bàn giao két tiền, sơ chế, vệ sinh)
    KitchenClosing = 3,       // Đóng ca vệ sinh bếp (Tắt bếp hầm, cọ sàn, bọc màng thực phẩm)
    FoodSafety = 4,           // An toàn thực phẩm (Lưu mẫu 24h, date dán FIFO, thớt dao riêng)
    CashRegisterClosing = 5   // Chốt két thu ngân (Đối soát két tiền vs POS, nộp tiền)
}
