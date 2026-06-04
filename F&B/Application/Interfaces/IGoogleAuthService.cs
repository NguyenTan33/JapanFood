using Application.DTOs.Auth;

namespace Application.Interfaces;

public interface IGoogleAuthService
{
    Task<LoginResponse> GoogleLoginAsync(GoogleLoginRequest request);
    Task<LoginResponse> GoogleRegisterAsync(GoogleRegisterRequest request);
}
