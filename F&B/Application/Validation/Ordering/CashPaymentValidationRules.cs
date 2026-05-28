using Application.Common.Validation;
using Application.DTOs.Ordering;
using Domain.Exceptions;

namespace Application.Validation.Ordering;

public class ConfirmCashPaymentValidationRule : IValidationRule<ConfirmCashPaymentRequestDto>
{
    public Task ValidateAsync(ConfirmCashPaymentRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu thanh toán tiền mặt không được để trống.");

        if (request.OrderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");

        if (request.AmountGiven <= 0)
            throw new BusinessException("Số tiền khách đưa phải lớn hơn 0.");

        if (!string.IsNullOrWhiteSpace(request.CustomerPhone) && request.CustomerPhone.Trim().Length > 20)
            throw new BusinessException("Số điện thoại khách hàng không hợp lệ.");

        return Task.CompletedTask;
    }
}
