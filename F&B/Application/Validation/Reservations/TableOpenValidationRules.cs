using Application.Common.Validation;
using Application.DTOs.Reservations;
using Domain.Exceptions;

namespace Application.Validation.Reservations;

public class OpenTableValidationRule : IValidationRule<OpenTableRequestDto>
{
    public Task ValidateAsync(OpenTableRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Yêu cầu mở bàn không được để trống.");

        if (request.GuestCount < 1 || request.GuestCount > 50)
            throw new BusinessException("Số lượng khách vào bàn phải từ 1 đến 50 người.");

        if (!string.IsNullOrWhiteSpace(request.Notes) && request.Notes.Trim().Length > 255)
            throw new BusinessException("Ghi chú mở bàn không được vượt quá 255 ký tự.");

        return Task.CompletedTask;
    }
}

public class VerifyTableNetworkValidationRule : IValidationRule<VerifyTableNetworkRequestDto>
{
    public Task ValidateAsync(VerifyTableNetworkRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Yêu cầu kiểm tra mạng không được để trống.");

        if (request.TableId <= 0)
            throw new BusinessException("Mã bàn không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.Token) && string.IsNullOrWhiteSpace(request.PinCode))
            throw new BusinessException("Vui lòng cung cấp mã Token phiên hoặc Mã PIN bàn.");

        return Task.CompletedTask;
    }
}
