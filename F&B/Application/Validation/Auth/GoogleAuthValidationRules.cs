using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Exceptions;

namespace Application.Validation.Auth;

public class GoogleLoginValidationRule : IValidationRule<GoogleLoginRequest>
{
    public Task ValidateAsync(GoogleLoginRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu đăng nhập Google không được để trống.");

        if (string.IsNullOrWhiteSpace(request.IdToken))
            throw new BusinessException("IdToken Google không được để trống.");

        if (request.IdToken.Length > 4096)
            throw new BusinessException("IdToken Google không hợp lệ.");

        return Task.CompletedTask;
    }
}

public class GoogleRegisterValidationRule : IValidationRule<GoogleRegisterRequest>
{
    private readonly IPhoneService _phoneService;

    public GoogleRegisterValidationRule(IPhoneService phoneService)
    {
        _phoneService = phoneService;
    }

    public Task ValidateAsync(GoogleRegisterRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu đăng ký Google không được để trống.");

        if (string.IsNullOrWhiteSpace(request.IdToken))
            throw new BusinessException("IdToken Google không được để trống.");

        if (request.IdToken.Length > 4096)
            throw new BusinessException("IdToken Google không hợp lệ.");

        if (!string.IsNullOrWhiteSpace(request.FullName) && request.FullName.Trim().Length > 255)
        {
            throw new BusinessException("Họ và tên không được vượt quá 255 ký tự.");
        }

        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            var normalized = _phoneService.Normalize(request.PhoneNumber);
            if (!_phoneService.IsValid(normalized))
            {
                throw new BusinessException("Số điện thoại không đúng định dạng chuẩn Việt Nam.");
            }
        }

        return Task.CompletedTask;
    }
}
