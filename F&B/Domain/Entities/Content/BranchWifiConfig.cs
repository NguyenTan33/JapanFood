using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Content;

/// <summary>
/// Cấu hình mạng WiFi SSID của chi nhánh nhà hàng để phục vụ việc xác thực khách quét QR gọi món tại bàn
/// </summary>
public class BranchWifiConfig : BaseAuditableEntity
{
    public int BranchId { get; protected set; }
    public string Ssid { get; protected set; } = string.Empty;
    public string? Bssid { get; protected set; }
    public string? PublicIpSubnet { get; protected set; }
    public string? Description { get; protected set; }
    public bool IsActive { get; protected set; } = true;

    // Navigation
    public virtual Branch Branch { get; protected set; } = null!;

    protected BranchWifiConfig() { }

    public BranchWifiConfig(
        int branchId,
        string ssid,
        string? bssid = null,
        string? publicIpSubnet = null,
        string? description = null,
        bool isActive = true)
    {
        if (branchId <= 0)
            throw new BusinessException("Mã chi nhánh không hợp lệ.");
        if (string.IsNullOrWhiteSpace(ssid))
            throw new BusinessException("Tên mạng WiFi (SSID) không được để trống.");

        BranchId = branchId;
        Ssid = ssid.Trim();
        Bssid = bssid?.Trim().ToUpperInvariant();
        PublicIpSubnet = publicIpSubnet?.Trim();
        Description = description?.Trim();
        IsActive = isActive;
    }

    public void Update(string ssid, string? bssid = null, string? publicIpSubnet = null, string? description = null)
    {
        if (string.IsNullOrWhiteSpace(ssid))
            throw new BusinessException("Tên mạng WiFi (SSID) không được để trống.");

        Ssid = ssid.Trim();
        Bssid = bssid?.Trim().ToUpperInvariant();
        PublicIpSubnet = publicIpSubnet?.Trim();
        Description = description?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void ToggleActive(bool isActive)
    {
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }
}
