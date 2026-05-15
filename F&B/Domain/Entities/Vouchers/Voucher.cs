using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Vouchers;

public class Voucher : BaseAuditableEntity
{
    public string VoucherCode { get; protected set; } = string.Empty;
    public string? Title { get; protected set; }
    public string? Description { get; protected set; }
    public DiscountType DiscountType { get; protected set; }
    public decimal DiscountValue { get; protected set; }
    public decimal MinOrderAmount { get; protected set; }
    public decimal? MaxDiscountAmount { get; protected set; }
    public int UsageLimit { get; protected set; }
    public int UsedCount { get; protected set; }
    public int UsagePerUserLimit { get; protected set; } = 1;
    public DateTime StartDate { get; protected set; }
    public DateTime EndDate { get; protected set; }
    public bool IsActive { get; protected set; } = true;
    public byte[]? RowVersion { get; protected set; }

    private readonly List<UserVoucherUsage> _usages = new();
    public virtual IReadOnlyCollection<UserVoucherUsage> Usages => _usages.AsReadOnly();

    protected Voucher() { }

    public Voucher(
        string voucherCode,
        DiscountType discountType,
        decimal discountValue,
        DateTime startDate,
        DateTime endDate,
        decimal minOrderAmount = 0m,
        decimal? maxDiscountAmount = null,
        int usageLimit = 100,
        int usagePerUserLimit = 1,
        string? title = null,
        string? description = null)
    {
        if (string.IsNullOrWhiteSpace(voucherCode))
            throw new BusinessException("Mã voucher không được để trống.");
        if (discountValue <= 0)
            throw new BusinessException("Giá trị giảm giá phải lớn hơn 0.");
        if (discountType == DiscountType.Percentage && discountValue > 100)
            throw new BusinessException("Giảm giá phần trăm không được vượt quá 100%.");
        if (endDate <= startDate)
            throw new BusinessException("Ngày kết thúc voucher phải sau ngày bắt đầu.");
        if (minOrderAmount < 0)
            throw new BusinessException("Giá trị đơn hàng tối thiểu không được âm.");
        if (usageLimit <= 0)
            throw new BusinessException("Số lượt sử dụng tối đa phải lớn hơn 0.");
        if (usagePerUserLimit <= 0)
            throw new BusinessException("Số lượt sử dụng cho mỗi người dùng phải lớn hơn 0.");

        VoucherCode = voucherCode.Trim().ToUpperInvariant();
        Title = title?.Trim();
        Description = description?.Trim();
        DiscountType = discountType;
        DiscountValue = discountValue;
        StartDate = startDate;
        EndDate = endDate;
        MinOrderAmount = minOrderAmount;
        MaxDiscountAmount = maxDiscountAmount;
        UsageLimit = usageLimit;
        UsedCount = 0;
        UsagePerUserLimit = usagePerUserLimit;
        IsActive = true;
    }

    public void UpdateDetails(
        string? title,
        string? description,
        DiscountType discountType,
        decimal discountValue,
        DateTime startDate,
        DateTime endDate,
        decimal minOrderAmount,
        decimal? maxDiscountAmount,
        int usageLimit,
        int usagePerUserLimit,
        bool isActive)
    {
        if (discountValue <= 0)
            throw new BusinessException("Giá trị giảm giá phải lớn hơn 0.");
        if (discountType == DiscountType.Percentage && discountValue > 100)
            throw new BusinessException("Giảm giá phần trăm không được vượt quá 100%.");
        if (endDate <= startDate)
            throw new BusinessException("Ngày kết thúc voucher phải sau ngày bắt đầu.");
        if (minOrderAmount < 0)
            throw new BusinessException("Giá trị đơn hàng tối thiểu không được âm.");
        if (usageLimit <= 0)
            throw new BusinessException("Số lượt sử dụng tối đa phải lớn hơn 0.");
        if (usagePerUserLimit <= 0)
            throw new BusinessException("Số lượt sử dụng cho mỗi người dùng phải lớn hơn 0.");

        Title = title?.Trim();
        Description = description?.Trim();
        DiscountType = discountType;
        DiscountValue = discountValue;
        StartDate = startDate;
        EndDate = endDate;
        MinOrderAmount = minOrderAmount;
        MaxDiscountAmount = maxDiscountAmount;
        UsageLimit = usageLimit;
        UsagePerUserLimit = usagePerUserLimit;
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ValidateApplicable(decimal subTotal, int userUsageCount = 0)
    {
        var now = DateTime.UtcNow;

        if (!IsActive)
            throw new BusinessException($"Voucher '{VoucherCode}' hiện đang tạm khóa hoặc không hoạt động.");
        if (now < StartDate)
            throw new BusinessException($"Voucher '{VoucherCode}' chưa đến thời gian áp dụng (Bắt đầu từ: {StartDate:dd/MM/yyyy HH:mm}).");
        if (now > EndDate)
            throw new BusinessException($"Voucher '{VoucherCode}' đã hết hạn sử dụng (Hết hạn lúc: {EndDate:dd/MM/yyyy HH:mm}).");
        if (UsedCount >= UsageLimit)
            throw new BusinessException($"Voucher '{VoucherCode}' đã hết lượt sử dụng.");
        if (subTotal < MinOrderAmount)
            throw new BusinessException($"Đơn hàng chưa đạt giá trị tối thiểu {MinOrderAmount:N0}đ để sử dụng voucher '{VoucherCode}'.");
        if (userUsageCount >= UsagePerUserLimit)
            throw new BusinessException($"Bạn đã dùng voucher '{VoucherCode}' {userUsageCount} lần (Hạn mức cho mỗi tài khoản: {UsagePerUserLimit} lần).");
    }

    public decimal CalculateDiscount(decimal subTotal)
    {
        ValidateApplicable(subTotal);

        decimal discount = DiscountType switch
        {
            DiscountType.Percentage => subTotal * (DiscountValue / 100m),
            DiscountType.FixedAmount => DiscountValue,
            _ => 0m
        };

        if (MaxDiscountAmount.HasValue && discount > MaxDiscountAmount.Value)
        {
            discount = MaxDiscountAmount.Value;
        }

        return Math.Min(discount, subTotal);
    }

    public UserVoucherUsage RecordUsage(int userId, int orderId, decimal discountApplied, int userUsageCount = 0, decimal? orderSubTotal = null)
    {
        if (userId <= 0)
            throw new BusinessException("Mã người dùng không hợp lệ.");
        if (orderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");
        if (discountApplied <= 0)
            throw new BusinessException("Số tiền giảm giá áp dụng phải lớn hơn 0.");

        ValidateApplicable(orderSubTotal ?? Math.Max(discountApplied, MinOrderAmount), userUsageCount);

        UsedCount++;
        var usage = new UserVoucherUsage(Id, userId, orderId, discountApplied);
        _usages.Add(usage);
        return usage;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
