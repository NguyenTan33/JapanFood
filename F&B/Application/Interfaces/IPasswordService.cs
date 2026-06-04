using Application.DTOs.Auth;

namespace Application.Interfaces;

public interface IPasswordService
{
    Task<ForgotPasswordResponse> ForgotPasswordAsync(ForgotPasswordRequest request);
    Task ResetPasswordAsync(ResetPasswordRequest request);
    Task ChangePasswordAsync(string userId, ChangePasswordRequest request);
}
