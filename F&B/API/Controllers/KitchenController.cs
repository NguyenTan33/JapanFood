using API.Security;
using Application.DTOs.Kds;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Constants;
using Domain.Entities.Kds;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff},{AppRoles.Kitchen}")]
[EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
[Route("api/kitchen")]
public class KitchenController : BaseApiController
{
    private readonly IKitchenQueryRepository _kitchenQueryRepo;
    private readonly IKitchenService _kitchenService;

    public KitchenController(
        IKitchenQueryRepository kitchenQueryRepo,
        IKitchenService kitchenService)
    {
        _kitchenQueryRepo = kitchenQueryRepo;
        _kitchenService = kitchenService;
    }

    /// <summary>
    /// Màn hình trạm bếp hiển thị danh sách phiếu bếp theo thứ tự FIFO (Vào trước làm trước)
    /// </summary>
    [HttpGet("tickets")]
    [ProducesResponseType(typeof(List<KitchenTicketDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActiveTickets([FromQuery] KitchenStationType stationType, CancellationToken ct)
    {
        var tickets = await _kitchenQueryRepo.GetActiveKitchenTicketsByStationAsync(stationType, ct);
        return Ok(tickets);
    }

    /// <summary>
    /// Đầu bếp bấm nhận món và bắt đầu chế biến (Chuyển trạng thái Cooking)
    /// </summary>
    [HttpPut("items/{ticketItemId:int}/start-cooking")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> StartCookingItem(int ticketItemId, CancellationToken ct)
    {
        var cookUserId = GetCurrentUserId();
        if (!cookUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _kitchenService.StartCookingItemAsync(ticketItemId, cookUserId.Value, ct);
        return Ok(new { message = "Món ăn đã chuyển sang trạng thái đang nấu (Cooking)." });
    }

    /// <summary>
    /// Đầu bếp bấm hoàn tất nấu món (Chuyển trạng thái Ready để phục vụ bưng ra)
    /// </summary>
    [HttpPut("items/{ticketItemId:int}/mark-ready")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkItemReady(int ticketItemId, CancellationToken ct)
    {
        var cookUserId = GetCurrentUserId();
        if (!cookUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _kitchenService.MarkItemReadyAsync(ticketItemId, cookUserId.Value, ct);
        return Ok(new { message = "Món ăn đã nấu xong, chuyển sang trạng thái chờ phục vụ (Ready)." });
    }

    /// <summary>
    /// Phục vụ bưng món ra bàn cho khách (Chuyển trạng thái Served)
    /// </summary>
    [HttpPut("items/{ticketItemId:int}/mark-served")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkItemServed(int ticketItemId, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _kitchenService.MarkItemServedAsync(ticketItemId, staffUserId.Value, ct);
        return Ok(new { message = "Món ăn đã được phục vụ đến bàn (Served)." });
    }

    /// <summary>
    /// [POS & Giám sát] Danh sách món ăn bị trễ quá 15 phút chưa nấu xong trên toàn hệ thống để hiển thị chuông cảnh báo
    /// </summary>
    [HttpGet("overdue-alerts")]
    [ProducesResponseType(typeof(List<OverdueKitchenAlertDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverdueAlerts([FromQuery] int thresholdMinutes = 15, CancellationToken ct = default)
    {
        var safeThreshold = Math.Clamp(thresholdMinutes, 5, 120);
        var alerts = await _kitchenQueryRepo.GetOverdueKitchenAlertsAsync(safeThreshold, ct);
        return Ok(alerts);
    }

    /// <summary>
    /// [KDS Screen] Lấy danh sách món theo tab (unfinished, completed, cancelled) và số lượng tổng hợp
    /// </summary>
    [HttpGet("items")]
    [ProducesResponseType(typeof(KitchenItemsResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetKitchenItems(
        [FromQuery] string tab = "unfinished",
        [FromQuery] int? tableId = null,
        [FromQuery] string? search = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var result = await _kitchenQueryRepo.GetKitchenItemsAsync(tab, tableId, search, fromDate, toDate, ct);
        return Ok(result);
    }

    /// <summary>
    /// [KDS Screen] Hoàn thành chế biến món ăn và in vé phiếu nếu cần
    /// </summary>
    [HttpPost("items/{ticketItemId:int}/complete")]
    [ProducesResponseType(typeof(CompleteOrReprintResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> CompleteKitchenItem(int ticketItemId, CancellationToken ct = default)
    {
        var cookUserId = GetCurrentUserId() ?? 1;
        var result = await _kitchenService.CompleteKitchenItemAsync(ticketItemId, cookUserId, ct);
        return Ok(result);
    }

    /// <summary>
    /// [KDS Screen] In lại phiếu món ăn
    /// </summary>
    [HttpPost("items/{ticketItemId:int}/reprint")]
    [ProducesResponseType(typeof(CompleteOrReprintResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ReprintKitchenItem(int ticketItemId, CancellationToken ct = default)
    {
        var result = await _kitchenService.ReprintKitchenItemAsync(ticketItemId, ct);
        return Ok(result);
    }
}
