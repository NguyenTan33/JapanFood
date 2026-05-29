using Application.Common.Validation;
using Application.DTOs.Operations;
using Domain.Exceptions;

namespace Application.Validation.Operations;

public class OpenShiftValidationRule : IValidationRule<OpenShiftRequestDto>
{
    public Task ValidateAsync(OpenShiftRequestDto request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu mở ca trực không được để trống.");

        if (request.OpeningCash < 0)
            throw new BusinessException("Tiền đầu ca không được âm.");

        if (!string.IsNullOrWhiteSpace(request.Notes) && request.Notes.Trim().Length > 500)
            throw new BusinessException("Ghi chú mở ca không được vượt quá 500 ký tự.");

        return Task.CompletedTask;
    }
}

public class CloseShiftValidationRule : IValidationRule<CloseShiftRequestDto>
{
    public Task ValidateAsync(CloseShiftRequestDto request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu đóng ca trực không được để trống.");

        if (request.ActualCash < 0)
            throw new BusinessException("Tiền mặt thực tế kiểm đếm không được âm.");

        if (!string.IsNullOrWhiteSpace(request.Notes) && request.Notes.Trim().Length > 500)
            throw new BusinessException("Ghi chú đóng ca không được vượt quá 500 ký tự.");

        return Task.CompletedTask;
    }
}
