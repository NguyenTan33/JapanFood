using API.Security;
using Application.Common.Models;
using Application.DTOs.Operations;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
[EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
[Route("api/shifts")]
public class ShiftsController : BaseApiController
{
    private readonly IShiftService _shiftService;
    private readonly IShiftQueryRepository _shiftQueryRepo;

    public ShiftsController(IShiftService shiftService, IShiftQueryRepository shiftQueryRepo)
    {
        _shiftService = shiftService;
        _shiftQueryRepo = shiftQueryRepo;
    }

    [HttpGet("current")]
    [ProducesResponseType(typeof(CurrentShiftResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCurrentShift(CancellationToken ct)
    {
        var result = await _shiftQueryRepo.GetCurrentShiftAsync(ct);
        return Ok(result);
    }

    [HttpPost("open")]
    [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> OpenShift([FromBody] OpenShiftRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        var shift = await _shiftService.OpenShiftAsync(request, staffUserId.Value, ct);
        return StatusCode(StatusCodes.Status201Created, shift);
    }

    [HttpPost("close")]
    [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> CloseShift([FromBody] CloseShiftRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        var current = await _shiftQueryRepo.GetCurrentShiftAsync(ct);
        if (current.HasOpenShift && current.Shift != null)
        {
            var expectedCash = current.Shift.CurrentRemainingCash;
            if (request.ActualCash != expectedCash)
            {
                var diff = request.ActualCash - expectedCash;
                var diffText = diff < 0 ? $"thiếu {Math.Abs(diff):N0} đ" : $"thừa {diff:N0} đ";
                return BadRequest(new
                {
                    statusCode = 400,
                    code = "CASH_DISCREPANCY_NOT_ALLOWED",
                    message = $"Số tiền kiểm đếm thực tế ({request.ActualCash:N0} đ) đang bị chênh lệch ({diffText}) so với tiền mặt trong két ({expectedCash:N0} đ). Vui lòng liên hệ Admin xử lý, khi nào ghi nhận đủ đúng số tiền mới được phép đóng ca!"
                });
            }
        }

        var shift = await _shiftService.CloseShiftAsync(request, staffUserId.Value, ct);
        return Ok(shift);
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ShiftDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetShifts(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _shiftQueryRepo.GetShiftsAsync(fromDate, toDate, page, pageSize, ct);
        return Ok(result);
    }

    [Authorize(Roles = AppRoles.Admin)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    [HttpPost("current/withdrawals")]
    [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> WithdrawFromCurrentShift([FromForm] WithdrawCashDrawerFormRequest request, CancellationToken ct)
    {
        var adminUserId = GetCurrentUserId();
        if (!adminUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        if (request.Photo == null || request.Photo.Length == 0)
        {
            return BadRequest(new { message = "Vui lòng chụp hoặc tải lên ảnh xác nhận thu tiền két." });
        }

        const long maxFileSize = 5 * 1024 * 1024;
        if (request.Photo.Length > maxFileSize)
        {
            return BadRequest(new { message = "Kích thước tệp ảnh không được vượt quá 5MB." });
        }

        using var stream = request.Photo.OpenReadStream();
        var updatedShift = await _shiftService.WithdrawFromCurrentShiftAsync(
            request.Amount,
            request.Note,
            stream,
            request.Photo.FileName,
            adminUserId.Value,
            ct);

        return StatusCode(StatusCodes.Status201Created, updatedShift);
    }
}

public class WithdrawCashDrawerFormRequest
{
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public IFormFile? Photo { get; set; }
}
