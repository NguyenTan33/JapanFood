namespace Application.DTOs.Auth;

public record ResendOtpRequest
{
    public string? Email { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public string Purpose { get; set; } = "Register";
}

public record ResendOtpResponse
{
    public string Message { get; set; } = string.Empty;
}
