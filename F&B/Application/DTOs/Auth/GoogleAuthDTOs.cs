namespace Application.DTOs.Auth;

public record GoogleLoginRequest
{
    public string IdToken { get; set; } = string.Empty;
}

public record GoogleRegisterRequest
{
    public string IdToken { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? FullName { get; set; }
    public string? StreetAddress { get; set; }
    public string? Ward { get; set; }
    public string? District { get; set; }
    public string? City { get; set; }
}
