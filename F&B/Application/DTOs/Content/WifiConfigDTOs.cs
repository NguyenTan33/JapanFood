namespace Application.DTOs.Content;

public class BranchWifiConfigDto
{
    public int Id { get; set; }
    public int BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string Ssid { get; set; } = string.Empty;
    public string? Bssid { get; set; }
    public string? PublicIpSubnet { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateBranchWifiConfigRequestDto
{
    public int BranchId { get; set; }
    public string Ssid { get; set; } = string.Empty;
    public string? Bssid { get; set; }
    public string? PublicIpSubnet { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateBranchWifiConfigRequestDto
{
    public string Ssid { get; set; } = string.Empty;
    public string? Bssid { get; set; }
    public string? PublicIpSubnet { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}
