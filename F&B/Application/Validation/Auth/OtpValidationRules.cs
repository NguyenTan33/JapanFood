using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Exceptions;

namespace Application.Validation.Auth;

internal static class AuthIdentifierValidationHelper
{
    public static void ValidatePhoneOrEmail(IPhoneService phoneService, string? phoneNumber, string? email)
    {
        var hasEmail = !string.IsNullOrWhiteSpace(email);
        var hasPhone = !string.IsNullOrWhiteSpace(phoneNumber);

        if (!hasEmail && !hasPhone)
            throw new BusinessException("Số điện thoại không được để trống.");

        if (hasPhone)
        {
            var phoneTrimmed = phoneNumber!.Trim();
            if (phoneTrimmed.Contains('@'))
            {
                if (phoneTrimmed.Length > 100 || !phoneTrimmed.Contains('.'))
                    throw new BusinessException("Địa chỉ Email không hợp lệ.");
                return;
            }

            var normalizedPhone = phoneService.Normalize(phoneTrimmed);
            if (!phoneService.IsValid(normalizedPhone))
                throw new BusinessException("Số điện thoại không hợp lệ.");
            return;
        }

        var emailTrimmed = email!.Trim();
        if (emailTrimmed.Length > 100 || !emailTrimmed.Contains('@') || !emailTrimmed.Contains('.'))
            throw new BusinessException("Địa chỉ Email không hợp lệ.");
    }
}

public class VerifyRegisterOtpValidationRule : IValidationRule<VerifyRegisterOtpRequest>
{
    private readonly IPhoneService _phoneService;

    public VerifyRegisterOtpValidationRule(IPhoneService phoneService)
    {
        _phoneService = phoneService;
    }

    public Task ValidateAsync(VerifyRegisterOtpRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu xác thực OTP không được để trống.");

        AuthIdentifierValidationHelper.ValidatePhoneOrEmail(_phoneService, request.PhoneNumber, request.Email);

        if (string.IsNullOrWhiteSpace(request.Otp) || request.Otp.Length != 6 || !request.Otp.All(char.IsDigit))
            throw new BusinessException("Mã OTP phải gồm đúng 6 chữ số.");

        return Task.CompletedTask;
    }
}

public class VerifyForgotPasswordOtpValidationRule : IValidationRule<VerifyForgotPasswordOtpRequest>
{
    private readonly IPhoneService _phoneService;

    public VerifyForgotPasswordOtpValidationRule(IPhoneService phoneService)
    {
        _phoneService = phoneService;
    }

    public Task ValidateAsync(VerifyForgotPasswordOtpRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu xác thực OTP không được để trống.");

        AuthIdentifierValidationHelper.ValidatePhoneOrEmail(_phoneService, request.PhoneNumber, request.Email);

        if (string.IsNullOrWhiteSpace(request.Otp) || request.Otp.Length != 6 || !request.Otp.All(char.IsDigit))
            throw new BusinessException("Mã OTP phải gồm đúng 6 chữ số.");

        return Task.CompletedTask;
    }
}

public class ResendOtpValidationRule : IValidationRule<ResendOtpRequest>
{
    private readonly IPhoneService _phoneService;

    public ResendOtpValidationRule(IPhoneService phoneService)
    {
        _phoneService = phoneService;
    }

    public Task ValidateAsync(ResendOtpRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu gửi lại OTP không được để trống.");

        AuthIdentifierValidationHelper.ValidatePhoneOrEmail(_phoneService, request.PhoneNumber, request.Email);

        if (string.IsNullOrWhiteSpace(request.Purpose) ||
            (request.Purpose != "Register" && request.Purpose != "ForgotPassword"))
        {
            throw new BusinessException("Mục đích yêu cầu OTP không hợp lệ (Chỉ chấp nhận 'Register' hoặc 'ForgotPassword').");
        }

        return Task.CompletedTask;
    }
}
