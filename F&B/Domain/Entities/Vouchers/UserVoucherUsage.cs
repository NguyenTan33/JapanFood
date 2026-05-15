using Domain.Entities.Common;
using Domain.Entities.Menu;
using Domain.Exceptions;

namespace Domain.Entities.Vouchers;

public class UserVoucherUsage : BaseEntity
{
    public int VoucherId { get; protected set; }
    public int UserId { get; protected set; }
    public int OrderId { get; protected set; }
    public decimal DiscountApplied { get; protected set; }
    public DateTime UsedAt { get; protected set; } = DateTime.UtcNow;

    public virtual Voucher? Voucher { get; protected set; }
    public virtual User? User { get; protected set; }
    public virtual Order? Order { get; protected set; }

    protected UserVoucherUsage() { }

    public UserVoucherUsage(int voucherId, int userId, int orderId, decimal discountApplied)
    {
        if (voucherId < 0)
            throw new BusinessException("Mã voucher không hợp lệ.");
        if (userId <= 0)
            throw new BusinessException("Mã người dùng không hợp lệ.");
        if (orderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");
        if (discountApplied <= 0)
            throw new BusinessException("Số tiền giảm giá áp dụng phải lớn hơn 0.");

        VoucherId = voucherId;
        UserId = userId;
        OrderId = orderId;
        DiscountApplied = discountApplied;
        UsedAt = DateTime.UtcNow;
    }
}
