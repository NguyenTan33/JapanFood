namespace Application.DTOs.Auth;

public record VerifyRegisterOtpRequest
{
    public string? Email { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
}

public record VerifyRegisterOtpResponse
{
    public string Message { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int? ExpiresInMinutes { get; set; }
    public UserProfileDto? User { get; set; }
}

public record VerifyForgotPasswordOtpRequest
{
    public string? Email { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
}

public record VerifyForgotPasswordOtpResponse
{
    public string ResetToken { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
}
