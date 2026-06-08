using API.Security;
using Application.DTOs.Vouchers;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[EnableRateLimiting(RateLimiterExtensions.CustomerPolicy)]
[Route("api/vouchers")]
public class VoucherController : BaseApiController
{
    private readonly IVoucherQueryRepository _voucherQueryRepo;
    private readonly IVoucherService _voucherService;

    public VoucherController(
        IVoucherQueryRepository voucherQueryRepo,
        IVoucherService voucherService)
    {
        _voucherQueryRepo = voucherQueryRepo;
        _voucherService = voucherService;
    }

    /// <summary>
    /// Lấy danh sách mã giảm giá (Mặc định: chỉ mã đang hoạt động cho khách hàng, hoặc tất cả bao gồm tạm dừng nếu includeInactive = true)
    /// </summary>
    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType(typeof(List<VoucherSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetVouchers([FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        if (includeInactive)
        {
            var allVouchers = await _voucherQueryRepo.GetAllVouchersAsync(ct);
            return Ok(allVouchers);
        }

        var vouchers = await _voucherQueryRepo.GetActivePublicVouchersAsync(ct);
        return Ok(vouchers);
    }

    /// <summary>
    /// Lấy toàn bộ danh sách mã giảm giá cho Quản lý / Nhân viên (bao gồm đang hoạt động và tạm dừng)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpGet("all")]
    [ProducesResponseType(typeof(List<VoucherSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllVouchers(CancellationToken ct = default)
    {
        var vouchers = await _voucherQueryRepo.GetAllVouchersAsync(ct);
        return Ok(vouchers);
    }

    /// <summary>
    /// Kiểm tra mã giảm giá và tính toán số tiền được giảm trước khi đặt đơn
    /// </summary>
    [Authorize]
    [HttpPost("apply")]
    [ProducesResponseType(typeof(VoucherValidationResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ApplyVoucher([FromBody] ApplyVoucherRequestDto request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để áp dụng mã giảm giá." });
        }

        request.UserId = userId.Value;
        var result = await _voucherService.ValidateAndApplyVoucherAsync(request, userId.Value, ct);
        return Ok(result);
    }

    /// <summary>
    /// Tạo mã khuyến mại mới (Dành cho Quản lý / Nhân viên thu ngân)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost]
    [ProducesResponseType(typeof(VoucherValidationResultDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateVoucher([FromBody] CreateVoucherRequestDto request, CancellationToken ct)
    {
        var result = await _voucherService.CreateVoucherAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Kích hoạt mã khuyến mại
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPatch("{id:int}/activate")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ActivateVoucher(int id, CancellationToken ct)
    {
        await _voucherService.ActivateVoucherAsync(id, ct);
        return Ok(new { message = "Đã kích hoạt mã khuyến mại thành công." });
    }

    /// <summary>
    /// Tạm khóa mã khuyến mại
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPatch("{id:int}/deactivate")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeactivateVoucher(int id, CancellationToken ct)
    {
        await _voucherService.DeactivateVoucherAsync(id, ct);
        return Ok(new { message = "Đã tạm dừng mã khuyến mại." });
    }

    /// <summary>
    /// Xóa mã khuyến mại (Chỉ Quản trị viên ADMIN mới có quyền xóa)
    /// </summary>
    [Authorize(Roles = AppRoles.Admin)]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteVoucher(int id, CancellationToken ct)
    {
        await _voucherService.DeleteVoucherAsync(id, ct);
        return Ok(new { message = "Xóa mã khuyến mại thành công." });
    }
}
