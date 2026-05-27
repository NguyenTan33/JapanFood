using Application.Common.Validation;
using Application.DTOs.Auth;
using Domain.Exceptions;

namespace Application.Validation.Auth;

public class RefreshTokenValidationRule : IValidationRule<RefreshTokenRequest>
{
    public Task ValidateAsync(RefreshTokenRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu làm mới token không được để trống.");

        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            throw new BusinessException("Refresh Token không hợp lệ.");

        return Task.CompletedTask;
    }
}

public class LogoutValidationRule : IValidationRule<LogoutRequest>
{
    public Task ValidateAsync(LogoutRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu đăng xuất không được để trống.");

        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            throw new BusinessException("Refresh Token không hợp lệ.");

        return Task.CompletedTask;
    }
}
