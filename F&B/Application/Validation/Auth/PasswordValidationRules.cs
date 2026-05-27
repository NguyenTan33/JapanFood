using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Exceptions;

namespace Application.Validation.Auth;

public class ForgotPasswordValidationRule : IValidationRule<ForgotPasswordRequest>
{
    private readonly IPhoneService _phoneService;

    public ForgotPasswordValidationRule(IPhoneService phoneService)
    {
        _phoneService = phoneService;
    }

    public Task ValidateAsync(ForgotPasswordRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu quên mật khẩu không được để trống.");

        AuthIdentifierValidationHelper.ValidatePhoneOrEmail(_phoneService, request.PhoneNumber, request.Email);

        return Task.CompletedTask;
    }
}

public class ResetPasswordValidationRule : IValidationRule<ResetPasswordRequest>
{
    private readonly IPhoneService _phoneService;

    public ResetPasswordValidationRule(IPhoneService phoneService)
    {
        _phoneService = phoneService;
    }

    public Task ValidateAsync(ResetPasswordRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu đặt lại mật khẩu không được để trống.");

        AuthIdentifierValidationHelper.ValidatePhoneOrEmail(_phoneService, request.PhoneNumber, request.Email);

        if (string.IsNullOrWhiteSpace(request.ResetToken))
            throw new BusinessException("Mã đặt lại mật khẩu không hợp lệ.");

        if (request.ResetToken.Trim().Length > 256)
            throw new BusinessException("Mã đặt lại mật khẩu không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            throw new BusinessException("Mật khẩu mới phải có ít nhất 6 ký tự.");

        if (request.NewPassword.Length > 128)
            throw new BusinessException("Mật khẩu mới không được vượt quá 128 ký tự.");

        if (request.NewPassword != request.ConfirmNewPassword)
            throw new BusinessException("Mật khẩu xác nhận không khớp.");

        return Task.CompletedTask;
    }
}

public class ChangePasswordValidationRule : IValidationRule<ChangePasswordRequest>
{
    public Task ValidateAsync(ChangePasswordRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu đổi mật khẩu không được để trống.");

        if (string.IsNullOrWhiteSpace(request.CurrentPassword))
            throw new BusinessException("Mật khẩu hiện tại không được để trống.");

        if (request.CurrentPassword.Length > 128)
            throw new BusinessException("Mật khẩu hiện tại không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            throw new BusinessException("Mật khẩu mới phải có ít nhất 6 ký tự.");

        if (request.NewPassword.Length > 128)
            throw new BusinessException("Mật khẩu mới không được vượt quá 128 ký tự.");

        if (request.NewPassword != request.ConfirmNewPassword)
            throw new BusinessException("Mật khẩu xác nhận không khớp.");

        if (request.CurrentPassword == request.NewPassword)
            throw new BusinessException("Mật khẩu mới không được trùng với mật khẩu hiện tại.");

        return Task.CompletedTask;
    }
}
