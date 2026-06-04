using Application.DTOs.Content;

namespace Application.Interfaces.Services;

public interface IWifiConfigService
{
    Task<List<BranchWifiConfigDto>> GetConfigsByBranchAsync(int branchId, CancellationToken ct = default);
    Task<BranchWifiConfigDto> CreateConfigAsync(CreateBranchWifiConfigRequestDto request, int userId, CancellationToken ct = default);
    Task<BranchWifiConfigDto> UpdateConfigAsync(int id, UpdateBranchWifiConfigRequestDto request, int userId, CancellationToken ct = default);
    Task<bool> DeleteConfigAsync(int id, int userId, CancellationToken ct = default);
    Task<bool> ToggleActiveAsync(int id, bool isActive, int userId, CancellationToken ct = default);
    Task<bool> IsNetworkAllowedAsync(int branchId, string? clientSsid, string? clientIp, CancellationToken ct = default);
}
