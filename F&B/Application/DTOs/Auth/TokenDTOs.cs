namespace Application.DTOs.Auth;

public record RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

public record RefreshTokenResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public int ExpiresInMinutes { get; set; }
}

public record LogoutRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}
