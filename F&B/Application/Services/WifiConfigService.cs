using Application.Common.Validation;
using Application.DTOs.Content;
using Application.Interfaces;
using Application.Interfaces.Services;
using Domain.Entities.Content;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class WifiConfigService : IWifiConfigService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IValidationFactory _validationFactory;
    private readonly ILogger<WifiConfigService> _logger;

    public WifiConfigService(
        IUnitOfWork unitOfWork,
        IValidationFactory validationFactory,
        ILogger<WifiConfigService> logger)
    {
        _unitOfWork = unitOfWork;
        _validationFactory = validationFactory;
        _logger = logger;
    }

    public async Task<List<BranchWifiConfigDto>> GetConfigsByBranchAsync(int branchId, CancellationToken ct = default)
    {
        return await _unitOfWork.Context.BranchWifiConfigs
            .AsNoTracking()
            .Where(w => w.BranchId == branchId)
            .OrderByDescending(w => w.IsActive)
            .ThenBy(w => w.Ssid)
            .Select(w => new BranchWifiConfigDto
            {
                Id = w.Id,
                BranchId = w.BranchId,
                BranchName = w.Branch.Name,
                Ssid = w.Ssid,
                Bssid = w.Bssid,
                PublicIpSubnet = w.PublicIpSubnet,
                Description = w.Description,
                IsActive = w.IsActive,
                CreatedAt = w.CreatedAt
            })
            .ToListAsync(ct);
    }

    public async Task<BranchWifiConfigDto> CreateConfigAsync(CreateBranchWifiConfigRequestDto request, int userId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        var branch = await _unitOfWork.Context.Branches
            .FirstOrDefaultAsync(b => b.Id == request.BranchId, ct);
        if (branch == null)
            throw new NotFoundException($"Không tìm thấy chi nhánh #{request.BranchId}.");

        var duplicate = await _unitOfWork.Context.BranchWifiConfigs
            .AnyAsync(w => w.BranchId == request.BranchId && w.Ssid == request.Ssid.Trim(), ct);
        if (duplicate)
            throw new ConflictException($"Tên sóng WiFi '{request.Ssid}' đã được cấu hình cho chi nhánh này.");

        var config = new BranchWifiConfig(
            request.BranchId,
            request.Ssid,
            request.Bssid,
            request.PublicIpSubnet,
            request.Description,
            request.IsActive);

        config.MarkCreated(userId);
        await _unitOfWork.Context.BranchWifiConfigs.AddAsync(config, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return new BranchWifiConfigDto
        {
            Id = config.Id,
            BranchId = config.BranchId,
            BranchName = branch.Name,
            Ssid = config.Ssid,
            Bssid = config.Bssid,
            PublicIpSubnet = config.PublicIpSubnet,
            Description = config.Description,
            IsActive = config.IsActive,
            CreatedAt = config.CreatedAt
        };
    }

    public async Task<BranchWifiConfigDto> UpdateConfigAsync(int id, UpdateBranchWifiConfigRequestDto request, int userId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        var config = await _unitOfWork.Context.BranchWifiConfigs
            .Include(w => w.Branch)
            .FirstOrDefaultAsync(w => w.Id == id, ct);
        if (config == null)
            throw new NotFoundException($"Không tìm thấy cấu hình WiFi #{id}.");

        var duplicate = await _unitOfWork.Context.BranchWifiConfigs
            .AnyAsync(w => w.BranchId == config.BranchId && w.Id != id && w.Ssid == request.Ssid.Trim(), ct);
        if (duplicate)
            throw new ConflictException($"Tên sóng WiFi '{request.Ssid}' đã tồn tại trong chi nhánh này.");

        config.Update(request.Ssid, request.Bssid, request.PublicIpSubnet, request.Description);
        config.ToggleActive(request.IsActive);
        config.MarkUpdated(userId);

        await _unitOfWork.SaveChangesAsync(ct);

        return new BranchWifiConfigDto
        {
            Id = config.Id,
            BranchId = config.BranchId,
            BranchName = config.Branch?.Name ?? "Chi nhánh",
            Ssid = config.Ssid,
            Bssid = config.Bssid,
            PublicIpSubnet = config.PublicIpSubnet,
            Description = config.Description,
            IsActive = config.IsActive,
            CreatedAt = config.CreatedAt
        };
    }

    public async Task<bool> DeleteConfigAsync(int id, int userId, CancellationToken ct = default)
    {
        var config = await _unitOfWork.Context.BranchWifiConfigs
            .FirstOrDefaultAsync(w => w.Id == id, ct);
        if (config == null)
            throw new NotFoundException($"Không tìm thấy cấu hình WiFi #{id}.");

        _unitOfWork.Context.BranchWifiConfigs.Remove(config);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> ToggleActiveAsync(int id, bool isActive, int userId, CancellationToken ct = default)
    {
        var config = await _unitOfWork.Context.BranchWifiConfigs
            .FirstOrDefaultAsync(w => w.Id == id, ct);
        if (config == null)
            throw new NotFoundException($"Không tìm thấy cấu hình WiFi #{id}.");

        config.ToggleActive(isActive);
        config.MarkUpdated(userId);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> IsNetworkAllowedAsync(int branchId, string? clientSsid, string? clientIp, CancellationToken ct = default)
    {
        // Cho phép môi trường thử nghiệm localhost / dev
        if (clientIp == "127.0.0.1" || clientIp == "::1" || clientIp == "localhost")
        {
            return true;
        }

        var activeConfigs = await _unitOfWork.Context.BranchWifiConfigs
            .AsNoTracking()
            .Where(w => w.BranchId == branchId && w.IsActive)
            .ToListAsync(ct);

        // Nếu chi nhánh chưa thiết lập cấu hình WiFi nào, tạm thời cho phép
        if (!activeConfigs.Any())
        {
            return true;
        }

        // 1. Kiểm tra theo SSID (nếu client gửi tên WiFi lên)
        if (!string.IsNullOrWhiteSpace(clientSsid))
        {
            var matchSsid = activeConfigs.Any(w =>
                string.Equals(w.Ssid.Trim(), clientSsid.Trim(), StringComparison.OrdinalIgnoreCase));
            if (matchSsid) return true;
        }

        // 2. Kiểm tra theo Client IP / Subnet quán
        if (!string.IsNullOrWhiteSpace(clientIp))
        {
            var cleanIp = clientIp.Trim();
            var matchIp = activeConfigs.Any(w =>
                !string.IsNullOrWhiteSpace(w.PublicIpSubnet) &&
                (cleanIp.Equals(w.PublicIpSubnet.Trim(), StringComparison.OrdinalIgnoreCase) ||
                 cleanIp.StartsWith(w.PublicIpSubnet.Trim(), StringComparison.OrdinalIgnoreCase)));
            if (matchIp) return true;
        }

        return false;
    }
}
