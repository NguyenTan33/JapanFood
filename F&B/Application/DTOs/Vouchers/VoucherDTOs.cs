using Domain.Entities.Vouchers;

namespace Application.DTOs.Vouchers;

public class VoucherSummaryDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string DiscountType { get; set; } = string.Empty;
    public decimal DiscountValue { get; set; }
    public decimal MinOrderAmount { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; }
}

public class VoucherValidationResultDto
{
    public bool IsValid { get; set; }
    public string? ErrorMessage { get; set; }
    public string? Message { get; set; }
    public int? VoucherId { get; set; }
    public string? VoucherCode { get; set; }
    public string? DiscountType { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal FinalTotal { get; set; }

    public static VoucherValidationResultDto Success(
        int voucherId,
        string voucherCode,
        decimal discountAmount,
        string? discountType = null,
        decimal finalTotal = 0m,
        string? message = null)
    {
        return new VoucherValidationResultDto
        {
            IsValid = true,
            VoucherId = voucherId,
            VoucherCode = voucherCode,
            DiscountType = discountType,
            DiscountAmount = discountAmount,
            FinalTotal = finalTotal,
            Message = message ?? "Áp dụng mã giảm giá thành công."
        };
    }

    public static VoucherValidationResultDto Invalid(string errorMessage)
    {
        return new VoucherValidationResultDto
        {
            IsValid = false,
            ErrorMessage = errorMessage,
            Message = errorMessage,
            DiscountAmount = 0m,
            FinalTotal = 0m
        };
    }
}

public class ApplyVoucherRequestDto
{
    public string Code { get; set; } = string.Empty;
    public decimal CurrentSubtotal { get; set; }
    public int UserId { get; set; }
}

public class CreateVoucherRequestDto
{
    public string VoucherCode { get; set; } = string.Empty;
    public DiscountType DiscountType { get; set; } = DiscountType.Percentage;
    public decimal DiscountValue { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal MinOrderAmount { get; set; } = 0m;
    public decimal? MaxDiscountAmount { get; set; }
    public int UsageLimit { get; set; } = 100;
    public int UsagePerUserLimit { get; set; } = 1;
}
