namespace Application.DTOs.Auth;

public record RegisterRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? StreetAddress { get; set; }
    public string? Ward { get; set; }
    public string? District { get; set; }
    public string? City { get; set; }
}

public record RegisterResponse
{
    public string UserId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
