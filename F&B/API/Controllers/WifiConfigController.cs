using API.Security;
using Application.DTOs.Content;
using Application.Interfaces.Services;
using Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
[EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
[Route("api/admin/wifi-configs")]
public class WifiConfigController : BaseApiController
{
    private readonly IWifiConfigService _wifiConfigService;

    public WifiConfigController(IWifiConfigService wifiConfigService)
    {
        _wifiConfigService = wifiConfigService;
    }

    /// <summary>
    /// Lấy danh sách toàn bộ cấu hình WiFi SSID theo chi nhánh (Quản trị viên / Quản lý)
    /// </summary>
    [HttpGet("branch/{branchId:int}")]
    [ProducesResponseType(typeof(List<BranchWifiConfigDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetConfigsByBranch(int branchId, CancellationToken ct)
    {
        var list = await _wifiConfigService.GetConfigsByBranchAsync(branchId, ct);
        return Ok(list);
    }

    /// <summary>
    /// Thêm mới mạng WiFi SSID cho chi nhánh
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(BranchWifiConfigDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateConfig([FromBody] CreateBranchWifiConfigRequestDto request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        var result = await _wifiConfigService.CreateConfigAsync(request, userId.Value, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Chỉnh sửa thông tin mạng WiFi SSID, dải IP subnet hoặc mô tả
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(BranchWifiConfigDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateConfig(int id, [FromBody] UpdateBranchWifiConfigRequestDto request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        var result = await _wifiConfigService.UpdateConfigAsync(id, request, userId.Value, ct);
        return Ok(result);
    }

    /// <summary>
    /// Xóa cấu hình WiFi khỏi chi nhánh (Chỉ Quản trị viên ADMIN mới có quyền xóa)
    /// </summary>
    [Authorize(Roles = AppRoles.Admin)]
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteConfig(int id, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _wifiConfigService.DeleteConfigAsync(id, userId.Value, ct);
        return Ok(new { message = "Đã xóa cấu hình WiFi thành công." });
    }

    /// <summary>
    /// Bật/Tắt trạng thái hoạt động của mạng WiFi
    /// </summary>
    [HttpPatch("{id:int}/toggle-status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ToggleStatus(int id, [FromBody] ToggleStatusRequest request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _wifiConfigService.ToggleActiveAsync(id, request.IsActive, userId.Value, ct);
        return Ok(new { message = request.IsActive ? "Đã kích hoạt mạng WiFi." : "Đã tạm dừng mạng WiFi." });
    }

    /// <summary>
    /// Lấy danh sách tên SSID đang hoạt động của quán (Dành cho khách hàng kiểm tra mạng)
    /// </summary>
    [AllowAnonymous]
    [HttpGet("active-ssids")]
    public async Task<IActionResult> GetActiveSsids([FromQuery] int branchId = 1, CancellationToken ct = default)
    {
        var list = await _wifiConfigService.GetConfigsByBranchAsync(branchId, ct);
        var activeSsids = list.Where(w => w.IsActive).Select(w => w.Ssid).ToList();
        return Ok(activeSsids);
    }

    /// <summary>
    /// Kiểm tra xác thực xem thiết bị của khách có thuộc mạng WiFi nội bộ của quán hay không
    /// </summary>
    [AllowAnonymous]
    [HttpGet("verify-network")]
    public async Task<IActionResult> VerifyNetwork(
        [FromQuery] int branchId = 1,
        [FromQuery] string? ssid = null,
        CancellationToken ct = default)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var isAllowed = await _wifiConfigService.IsNetworkAllowedAsync(branchId, ssid, clientIp, ct);
        return Ok(new { isAllowed, ssid, clientIp });
    }
}

public class ToggleStatusRequest
{
    public bool IsActive { get; set; }
}
