namespace Application.DTOs.Auth;

public record UserProfileDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string Role { get; set; } = string.Empty;
    public int LoyaltyPoints { get; set; }
    public string MembershipTier { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public record LoginRequest
{
    public string? Email { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public record LoginResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public int ExpiresInMinutes { get; set; }
    public UserProfileDto? User { get; set; }
}

public record UpdateProfileRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
}

public record SendPhoneOtpRequest
{
    public string NewPhoneNumber { get; set; } = string.Empty;
}

public record VerifyPhoneOtpRequest
{
    public string NewPhoneNumber { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
}
