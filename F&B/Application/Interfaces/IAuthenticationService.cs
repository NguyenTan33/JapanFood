using Application.DTOs.Auth;

namespace Application.Interfaces;

public interface IAuthenticationService
{
    Task<RegisterResponse> RegisterAsync(RegisterRequest request);
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task LogoutAsync(LogoutRequest request);
    Task<UserProfileDto> GetCurrentUserAsync(int userId, CancellationToken ct = default);
    Task<UserProfileDto> UpdateProfileAsync(int userId, UpdateProfileRequest request, CancellationToken ct = default);
    Task<string> SendChangePhoneOtpAsync(int userId, string newPhoneNumber, CancellationToken ct = default);
    Task<UserProfileDto> VerifyChangePhoneOtpAsync(int userId, string newPhoneNumber, string otp, CancellationToken ct = default);
}
