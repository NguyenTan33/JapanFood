using System.Security.Claims;
using API.Security;
using API.Services;
using Application.Interfaces;
using Domain.Constants;
using Domain.Entities.TableManagement;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

public class TableAlertRequestDto
{
    public int TableId { get; set; }
    public string? Token { get; set; }
}

/// <summary>
/// Yêu cầu từ khách tại bàn: Giục món (→ KDS rung thẻ 7s) và Gọi tính tiền (→ popup POS thu ngân).
/// </summary>
[Route("api/table-alerts")]
public class TableAlertController : BaseApiController
{
    private readonly TableAlertStore _store;
    private readonly IUnitOfWork _unitOfWork;

    public TableAlertController(TableAlertStore store, IUnitOfWork unitOfWork)
    {
        _store = store;
        _unitOfWork = unitOfWork;
    }

    /// <summary>[Khách tại bàn] Giục bếp làm món nhanh (giới hạn 3 phút/lần/bàn)</summary>
    [AllowAnonymous]
    [EnableRateLimiting(RateLimiterExtensions.CustomerPolicy)]
    [HttpPost("buzz")]
    public Task<IActionResult> Buzz([FromBody] TableAlertRequestDto request, CancellationToken ct)
        => CreateAlertAsync(TableAlertTypes.KitchenBuzz, request,
            "Khách đang đợi món, xin vui lòng ưu tiên chế biến nhanh!", ct);

    /// <summary>[Khách tại bàn] Gọi nhân viên tính tiền</summary>
    [AllowAnonymous]
    [EnableRateLimiting(RateLimiterExtensions.CustomerPolicy)]
    [HttpPost("bill")]
    public Task<IActionResult> CallBill([FromBody] TableAlertRequestDto request, CancellationToken ct)
        => CreateAlertAsync(TableAlertTypes.BillCall, request, "Khách yêu cầu thanh toán hóa đơn", ct);

    private async Task<IActionResult> CreateAlertAsync(string type, TableAlertRequestDto request, string note, CancellationToken ct)
    {
        if (request.TableId <= 0)
            return BadRequest(new { message = "Mã bàn không hợp lệ." });

        var table = await _unitOfWork.Context.Tables
            .Include(t => t.CurrentOrder)
            .FirstOrDefaultAsync(t => t.Id == request.TableId, ct);

        if (table == null)
            return NotFound(new { message = $"Không tìm thấy bàn #{request.TableId}." });

        if (table.Status != TableStatus.Serving || !table.CurrentOrderId.HasValue || table.CurrentOrder == null)
            return StatusCode(StatusCodes.Status400BadRequest, new { message = $"Bàn {table.TableNumber} hiện chưa có đơn hàng hoặc chưa mở phục vụ." });

        // Đối soát token nếu có gửi kèm
        if (!string.IsNullOrWhiteSpace(table.SessionToken) && !string.IsNullOrWhiteSpace(request.Token))
        {
            if (!string.Equals(table.SessionToken.Trim(), request.Token.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Phiên gọi món của bàn đã hết hạn hoặc không khớp. Vui lòng quét lại mã QR tại bàn." });
            }
        }

        // Kiểm tra mạng WiFi nếu có cấu hình IP Subnet
        var clientIp = GetClientIpAddress();
        var activeConfigs = await _unitOfWork.Context.BranchWifiConfigs
            .AsNoTracking()
            .Where(w => w.IsActive && !string.IsNullOrWhiteSpace(w.PublicIpSubnet))
            .ToListAsync(ct);

        if (activeConfigs.Any() && clientIp != "127.0.0.1" && clientIp != "::1" && clientIp != "localhost")
        {
            bool isWifiValid = activeConfigs.Any(w =>
                clientIp.Trim().Equals(w.PublicIpSubnet.Trim(), StringComparison.OrdinalIgnoreCase) ||
                clientIp.Trim().StartsWith(w.PublicIpSubnet.Trim(), StringComparison.OrdinalIgnoreCase));

            if (!isWifiValid)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Vui lòng kết nối đúng mạng WiFi của nhà hàng để gửi yêu cầu." });
            }
        }

        var remaining = _store.GetCooldownRemainingSeconds(type, request.TableId);
        if (remaining > 0)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = type == TableAlertTypes.KitchenBuzz
                    ? $"Bàn đã giục món gần đây. Vui lòng đợi {remaining}s trước khi nhắc lại."
                    : $"Yêu cầu tính tiền đã được gửi. Vui lòng đợi {remaining}s trước khi gửi tiếp.",
                retryAfterSeconds = remaining,
            });
        }

        var totalAmount = table.CurrentOrder.TotalAmount;
        var alert = _store.Add(type, table.Id, table.TableNumber, totalAmount, note);

        return Ok(new
        {
            success = true,
            alertId = alert.Id,
            tableNumber = table.TableNumber,
            totalAmount,
            cooldownSeconds = (int)(type == TableAlertTypes.KitchenBuzz
                ? TableAlertStore.BuzzCooldown.TotalSeconds
                : TableAlertStore.BillCooldown.TotalSeconds),
            message = type == TableAlertTypes.KitchenBuzz
                ? "Đã gửi yêu cầu ưu tiên tới bếp trưởng! Thẻ món của bàn sẽ rung trên màn hình bếp."
                : "Đã gửi yêu cầu thanh toán tới quầy thu ngân. Nhân viên phục vụ sẽ đến bàn hỗ trợ bạn ngay!",
        });
    }

    /// <summary>[POS/KDS] Lấy thông báo mới (polling) sau afterId</summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff},{AppRoles.Kitchen}")]
    [HttpGet]
    public IActionResult GetAlerts([FromQuery] long afterId = 0, [FromQuery] string? type = null)
    {
        // Bếp chỉ được nhận thông báo giục món
        if (User.IsInRole(AppRoles.Kitchen) && !IsStaffOrHigher())
            type = TableAlertTypes.KitchenBuzz;

        var (items, latestId) = _store.GetAfter(afterId, string.IsNullOrWhiteSpace(type) ? null : type);
        return Ok(new { items, latestId });
    }

    /// <summary>[POS] Danh sách yêu cầu tính tiền chưa xử lý</summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [HttpGet("pending-bills")]
    public IActionResult GetPendingBills() => Ok(_store.GetPendingBillCalls());

    /// <summary>[POS] Thu ngân xác nhận đã nhận yêu cầu tính tiền</summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [HttpPost("{id:long}/ack")]
    public IActionResult Acknowledge(long id)
    {
        var name = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("fullName");
        return _store.Acknowledge(id, name) ? Ok(new { success = true }) : NotFound(new { message = "Không tìm thấy thông báo." });
    }
}
