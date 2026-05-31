using Application.Common.Validation;
using Application.DTOs.Vouchers;
using Domain.Entities.Vouchers;
using Domain.Exceptions;

namespace Application.Validation.Vouchers;

public class ApplyVoucherValidationRule : IValidationRule<ApplyVoucherRequestDto>
{
    public ApplyVoucherValidationRule()
    {
    }

    public Task ValidateAsync(ApplyVoucherRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu áp dụng mã giảm giá không được để trống.");

        if (string.IsNullOrWhiteSpace(request.Code))
            throw new BusinessException("Mã voucher không được để trống.");

        if (request.Code.Trim().Length > 50)
            throw new BusinessException("Mã voucher không hợp lệ (tối đa 50 ký tự).");

        if (request.CurrentSubtotal <= 0)
            throw new BusinessException("Tạm tính đơn hàng phải lớn hơn 0đ để áp dụng voucher.");

        return Task.CompletedTask;
    }
}

public class CreateVoucherValidationRule : IValidationRule<CreateVoucherRequestDto>
{
    public CreateVoucherValidationRule()
    {
    }

    public Task ValidateAsync(CreateVoucherRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Thông tin mã giảm giá không được để trống.");

        if (string.IsNullOrWhiteSpace(request.VoucherCode))
            throw new BusinessException("Mã voucher không được để trống.");

        if (request.VoucherCode.Trim().Length > 50)
            throw new BusinessException("Mã voucher không được vượt quá 50 ký tự.");

        if (request.DiscountValue <= 0)
            throw new BusinessException("Giá trị giảm giá phải lớn hơn 0.");

        if (request.DiscountType == DiscountType.Percentage && request.DiscountValue > 100)
            throw new BusinessException("Giảm giá theo phần trăm không được vượt quá 100%.");

        if (request.EndDate <= request.StartDate)
            throw new BusinessException("Ngày kết thúc voucher phải sau ngày bắt đầu.");

        if (request.MinOrderAmount < 0)
            throw new BusinessException("Giá trị đơn hàng tối thiểu không được âm.");

        if (request.MaxDiscountAmount.HasValue && request.MaxDiscountAmount.Value < 0)
            throw new BusinessException("Mức giảm tối đa không được âm.");

        if (request.UsageLimit <= 0)
            throw new BusinessException("Số lượt sử dụng tối đa phải lớn hơn 0.");

        if (request.UsagePerUserLimit <= 0)
            throw new BusinessException("Số lượt sử dụng cho mỗi người dùng phải lớn hơn 0.");

        return Task.CompletedTask;
    }
}
