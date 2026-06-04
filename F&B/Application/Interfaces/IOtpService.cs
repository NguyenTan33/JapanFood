using Application.DTOs.Auth;

namespace Application.Interfaces;

public interface IOtpService
{
    Task<string> GenerateAndSaveOtpAsync(string phoneNumber, string purpose);
    Task ValidateOtpAsync(string phoneNumber, string otp, string purpose);
    Task<string> SendRegisterOtpAsync(string phoneNumber);
    Task<VerifyRegisterOtpResponse> VerifyRegisterOtpAsync(VerifyRegisterOtpRequest request);
    Task<string> SendForgotPasswordOtpAsync(string phoneNumber);
    Task<VerifyForgotPasswordOtpResponse> VerifyForgotPasswordOtpAsync(VerifyForgotPasswordOtpRequest request);
    Task<ResendOtpResponse> ResendOtpAsync(ResendOtpRequest request);
}
