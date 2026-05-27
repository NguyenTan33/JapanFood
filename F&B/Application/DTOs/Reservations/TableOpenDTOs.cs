namespace Application.DTOs.Reservations;

public class OpenTableRequestDto
{
    public int GuestCount { get; set; } = 2;
    public string? Notes { get; set; }
}

public class OpenTableResponseDto
{
    public int TableId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string SessionToken { get; set; } = string.Empty;
    public string PinCode { get; set; } = string.Empty;
    public string OrderQrUrl { get; set; } = string.Empty;
    public string VietQrUrl { get; set; } = string.Empty;
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
}

public class VerifyTableNetworkRequestDto
{
    public int TableId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string? PinCode { get; set; }
    public string? ClientSsid { get; set; }
    public string? ClientIp { get; set; }
}

public class VerifyTableNetworkResponseDto
{
    public bool IsAllowed { get; set; }
    public bool RequiresPin { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? SessionToken { get; set; }
    public int? BranchId { get; set; }
    public string? BranchName { get; set; }
    public string? TableNumber { get; set; }
    public int? CurrentOrderId { get; set; }
}

public class RegeneratePinResponseDto
{
    public int TableId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public string NewPinCode { get; set; } = string.Empty;
    public string SessionToken { get; set; } = string.Empty;
    public string OrderQrUrl { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}
