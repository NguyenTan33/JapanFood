using Application.DTOs.Auth;
using Domain.Entities;

namespace Application.Interfaces;

public interface ITokenService
{
    Task<string> GenerateAccessTokenAsync(User user);
    string GenerateRefreshToken();
    Task<RefreshTokenResponse> RefreshTokenAsync(RefreshTokenRequest request);
}
