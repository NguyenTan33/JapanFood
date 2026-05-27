using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Exceptions;

namespace Application.Validation.Auth;

public class LoginValidationRule : IValidationRule<LoginRequest>
{
    private readonly IPhoneService _phoneService;

    public LoginValidationRule(IPhoneService phoneService)
    {
        _phoneService = phoneService;
    }

    public Task ValidateAsync(LoginRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu đăng nhập không được để trống.");

        var hasEmail = !string.IsNullOrWhiteSpace(request.Email);
        var hasPhone = !string.IsNullOrWhiteSpace(request.PhoneNumber);

        if (!hasEmail && !hasPhone)
            throw new BusinessException("Số điện thoại hoặc Email không được để trống.");

        var identifier = hasEmail ? request.Email!.Trim() : request.PhoneNumber.Trim();
        if (identifier.Length > 100)
            throw new BusinessException("Thông tin đăng nhập không hợp lệ.");

        // Tự động nhận diện Email (chứa '@') hoặc Số điện thoại (chỉ có số hoặc +84)
        if (identifier.Contains('@'))
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(identifier, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
                throw new BusinessException("Địa chỉ Email không hợp lệ.");
        }
        else
        {
            var normalizedPhone = _phoneService.Normalize(identifier);
            if (!_phoneService.IsValid(normalizedPhone))
                throw new BusinessException("Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam hợp lệ (ví dụ: 0901234567 hoặc +84901234567).");
        }

        if (string.IsNullOrWhiteSpace(request.Password))
            throw new BusinessException("Mật khẩu không được để trống.");

        if (request.Password.Length > 128)
            throw new BusinessException("Mật khẩu không hợp lệ.");

        return Task.CompletedTask;
    }
}
