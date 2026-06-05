using API.Security;
using Application.Common.Models;
using Application.DTOs.Reservations;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Constants;
using Domain.Entities.Reservations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[EnableRateLimiting(RateLimiterExtensions.CustomerPolicy)]
[Route("api/reservations")]
public class TableReservationController : BaseApiController
{
    private readonly ITableReservationQueryRepository _reservationQueryRepo;
    private readonly ITableReservationService _reservationService;

    public TableReservationController(
        ITableReservationQueryRepository reservationQueryRepo,
        ITableReservationService reservationService)
    {
        _reservationQueryRepo = reservationQueryRepo;
        _reservationService = reservationService;
    }

    /// <summary>
    /// Lấy danh sách toàn bộ khu vực bàn (bao gồm cả ngừng hoạt động) cho Admin/Manager
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpGet("areas/all")]
    [ProducesResponseType(typeof(List<TableAreaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAreasForAdmin(CancellationToken ct = default)
    {
        var areas = await _reservationQueryRepo.GetAllAreasForAdminAsync(ct);
        return Ok(areas);
    }

    /// <summary>
    /// Tạo mới khu vực bàn ăn (Admin / Manager)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("areas")]
    [ProducesResponseType(typeof(TableAreaDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateArea([FromBody] CreateTableAreaRequestDto request, CancellationToken ct)
    {
        var created = await _reservationService.CreateAreaAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    /// <summary>
    /// Cập nhật thông tin khu vực bàn ăn (Admin / Manager)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPut("areas/{id:int}")]
    [ProducesResponseType(typeof(TableAreaDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateArea(int id, [FromBody] UpdateTableAreaRequestDto request, CancellationToken ct)
    {
        var updated = await _reservationService.UpdateAreaAsync(id, request, ct);
        return Ok(updated);
    }

    /// <summary>
    /// Bật/tắt trạng thái hoạt động của khu vực bàn ăn
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPatch("areas/{id:int}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetAreaStatus(int id, [FromBody] SetEntityStatusRequestDto request, CancellationToken ct)
    {
        await _reservationService.SetAreaStatusAsync(id, request.IsActive, ct);
        return Ok(new { message = "Cập nhật trạng thái khu vực thành công." });
    }

    /// <summary>
    /// Xóa khu vực bàn ăn (Chỉ Quản trị viên ADMIN mới có quyền xóa)
    /// </summary>
    [Authorize(Roles = AppRoles.Admin)]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpDelete("areas/{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteArea(int id, CancellationToken ct)
    {
        await _reservationService.DeleteAreaAsync(id, ct);
        return Ok(new { message = "Xóa khu vực bàn ăn thành công." });
    }

    /// <summary>
    /// Lấy danh sách khu vực bàn ăn đang hoạt động
    /// </summary>
    [AllowAnonymous]
    [HttpGet("areas")]
    [ProducesResponseType(typeof(List<TableAreaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAreas(CancellationToken ct = default)
    {
        var areas = await _reservationQueryRepo.GetActiveAreasAsync(ct);
        return Ok(areas);
    }

    /// <summary>
    /// Tìm danh sách bàn trống khả dụng theo khung giờ và số lượng khách (Interval Overlap)
    /// </summary>
    [AllowAnonymous]
    [HttpGet("available-tables")]
    [ProducesResponseType(typeof(List<TableDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> FindAvailableTables(
        [FromQuery] DateTime reservationTime,
        [FromQuery] int durationMinutes = 120,
        [FromQuery] int guestCount = 2,
        [FromQuery] int? areaId = null,
        CancellationToken ct = default)
    {
        var tables = await _reservationQueryRepo.FindAvailableTablesAsync(reservationTime, durationMinutes, guestCount, areaId, ct);
        return Ok(tables);
    }

    /// <summary>
    /// Đặt bàn trước trực tuyến (Yêu cầu đăng nhập tài khoản)
    /// </summary>
    [Authorize]
    [EnableRateLimiting(RateLimiterExtensions.AuthPolicy)]
    [HttpPost]
    [ProducesResponseType(typeof(ReservationSummaryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateReservation([FromBody] CreateReservationRequestDto request, CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để đặt bàn trực tuyến." });
        }

        // Chống giả mạo UserId: chỉ nhân viên mới được phép chỉ định UserId cho khách khác
        if (!IsStaffOrHigher() || !request.UserId.HasValue)
        {
            request.UserId = currentUserId.Value;
        }

        var result = await _reservationService.CreateReservationAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Xem lịch sử đặt bàn của tài khoản khách hàng hiện tại
    /// </summary>
    [Authorize]
    [HttpGet("my-history")]
    [ProducesResponseType(typeof(PagedResult<ReservationSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyReservationHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để xem lịch sử đặt bàn." });
        }

        var result = await _reservationQueryRepo.GetUserReservationHistoryAsync(userId.Value, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// Quản lý danh sách đặt bàn theo khoảng ngày, khu vực, trạng thái, tìm kiếm, phân trang kèm bộ đếm danh mục
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpGet("manage")]
    [ProducesResponseType(typeof(ReservationManageResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetManagedReservations([FromQuery] ReservationManageFilterDto filter, CancellationToken ct = default)
    {
        var result = await _reservationQueryRepo.GetManagedReservationsAsync(filter, ct);
        return Ok(result);
    }

    /// <summary>
    /// Đánh dấu khách không đến (No-Show)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("{id:int}/no-show")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkNoShow(int id, [FromBody] MarkNoShowRequestDto? request, CancellationToken ct)
    {
        await _reservationService.MarkNoShowAsync(id, request?.Notes, ct);
        return Ok(new { message = "Đã đánh dấu khách không đến (No-Show)." });
    }

    /// <summary>
    /// Xem danh sách khách đặt bàn đến trong ngày (Dành cho Lễ tân / Thu ngân)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpGet("daily")]
    [ProducesResponseType(typeof(List<ReservationSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDailyReservations(
        [FromQuery] DateTime? date,
        [FromQuery] ReservationStatus? status = null,
        [FromQuery] int? tableId = null,
        CancellationToken ct = default)
    {
        var queryDate = date ?? DateTime.UtcNow;
        var result = await _reservationQueryRepo.GetReservationsByDateAsync(queryDate, status, tableId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Nhân viên xác nhận lịch đặt bàn của khách
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("{id:int}/confirm")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ConfirmReservation(int id, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _reservationService.ConfirmReservationAsync(id, staffUserId.Value, ct);
        return Ok(new { message = "Xác nhận đặt bàn thành công." });
    }

    /// <summary>
    /// Lễ tân đón khách vào bàn (Chuyển bàn sang trạng thái Serving)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("{id:int}/check-in")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> CheckInGuest(int id, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _reservationService.CheckInGuestAsync(id, staffUserId.Value, ct);
        return Ok(new { message = "Đã check-in đón khách vào bàn thành công." });
    }

    /// <summary>
    /// Hủy lịch đặt bàn (Khách tự hủy hoặc Nhân viên hủy)
    /// </summary>
    [Authorize]
    [HttpPost("{id:int}/cancel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelReservation(int id, [FromBody] CancelReservationRequest request, CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để hủy đặt bàn." });
        }

        if (!IsStaffOrHigher())
        {
            var myHistory = await _reservationQueryRepo.GetUserReservationHistoryAsync(currentUserId.Value, 1, 100, ct);
            if (!myHistory.Items.Any(r => r.ReservationId == id))
            {
                return Forbid();
            }
        }

        await _reservationService.CancelReservationAsync(id, request.Reason, currentUserId.Value, ct);
        return Ok(new { message = "Hủy đặt bàn thành công." });
    }

    /// <summary>
    /// Sơ đồ toàn bộ bàn theo khu vực cho màn hình POS Thu ngân / Phục vụ
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpGet("tables")]
    [ProducesResponseType(typeof(List<TableDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllTablesForPOS([FromQuery] int? areaId, CancellationToken ct)
    {
        var tables = await _reservationQueryRepo.GetAllTablesAsync(areaId, ct);
        return Ok(tables);
    }

    /// <summary>
    /// Lấy toàn bộ bàn (bao gồm cả ngừng hoạt động) cho màn hình quản trị Admin/Manager
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpGet("tables/all")]
    [ProducesResponseType(typeof(List<TableDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllTablesForAdmin([FromQuery] int? areaId = null, CancellationToken ct = default)
    {
        var tables = await _reservationQueryRepo.GetAllTablesForAdminAsync(areaId, ct);
        return Ok(tables);
    }

    /// <summary>
    /// Tạo bàn ăn mới (Admin / Manager)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("tables")]
    [ProducesResponseType(typeof(TableDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateTable([FromBody] CreateTableRequestDto request, CancellationToken ct)
    {
        var created = await _reservationService.CreateTableAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    /// <summary>
    /// Cập nhật thông tin bàn ăn (Admin / Manager)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPut("tables/{id:int}")]
    [ProducesResponseType(typeof(TableDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateTable(int id, [FromBody] UpdateTableRequestDto request, CancellationToken ct)
    {
        var updated = await _reservationService.UpdateTableAsync(id, request, ct);
        return Ok(updated);
    }

    /// <summary>
    /// Bật/tắt trạng thái hoạt động của bàn ăn
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPatch("tables/{id:int}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetTableStatus(int id, [FromBody] SetEntityStatusRequestDto request, CancellationToken ct)
    {
        await _reservationService.SetTableStatusAsync(id, request.IsActive, ct);
        return Ok(new { message = "Cập nhật trạng thái bàn thành công." });
    }

    /// <summary>
    /// Xóa bàn ăn (Chỉ Quản trị viên ADMIN mới có quyền xóa)
    /// </summary>
    [Authorize(Roles = AppRoles.Admin)]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpDelete("tables/{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteTable(int id, CancellationToken ct)
    {
        await _reservationService.DeleteTableAsync(id, ct);
        return Ok(new { message = "Xóa bàn thành công." });
    }

    /// <summary>
    /// Nhân viên xác nhận dọn dẹp bàn hoàn tất (Chuyển bàn từ Cleaning sang Empty để đón khách mới)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("tables/{id:int}/complete-cleaning")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> CompleteCleaning(int id, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _reservationService.CompleteCleaningAsync(id, staffUserId.Value, ct);
        return Ok(new { message = $"Bàn #{id} đã được dọn sạch và sẵn sàng đón khách." });
    }

    /// <summary>
    /// Hủy bàn 0đ khi khách mở bàn nhưng rời đi mà không gọi món
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("tables/{id:int}/cancel-empty")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelEmptyTable(int id, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _reservationService.CancelEmptyTableAsync(id, staffUserId.Value, ct);
        return Ok(new { message = $"Đã hủy mở bàn #{id} thành công và đưa bàn về trạng thái trống." });
    }

    /// <summary>
    /// Chuyển bàn phục vụ (Chuyển toàn bộ đơn hàng đang dùng từ Bàn nguồn sang Bàn đích)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("tables/{sourceId:int}/transfer-to/{targetId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> TransferTable(int sourceId, int targetId, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _reservationService.TransferTableAsync(sourceId, targetId, staffUserId.Value, ct);
        return Ok(new { message = $"Đã chuyển bàn từ #{sourceId} sang #{targetId} thành công." });
    }

    /// <summary>
    /// Gộp bàn phục vụ cho đoàn khách đông người
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("tables/{masterId:int}/merge/{secondaryId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MergeTables(int masterId, int secondaryId, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _reservationService.MergeTablesAsync(masterId, secondaryId, staffUserId.Value, ct);
        return Ok(new { message = $"Đã gộp bàn #{secondaryId} vào bàn chính #{masterId} thành công." });
    }

    /// <summary>
    /// Nhân viên mở bàn tại chỗ (Dine-In) và sinh mã QR kèm Token để in bill đặt bàn cho khách gọi món
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("tables/{id:int}/open")]
    [ProducesResponseType(typeof(OpenTableResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> OpenTable(int id, [FromBody] OpenTableRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        var result = await _reservationService.OpenTableAsync(id, request, staffUserId.Value, ct);
        return Ok(result);
    }

    /// <summary>
    /// Thu ngân đổi mã PIN bàn tức thì khi bị lộ livestream hoặc nghi ngờ có người phá hoại
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("tables/{id:int}/regenerate-pin")]
    [ProducesResponseType(typeof(RegeneratePinResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> RegenerateTablePin(int id, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        var result = await _reservationService.RegenerateTablePinAsync(id, staffUserId.Value, ct);
        return Ok(result);
    }

    /// <summary>
    /// Khách quét QR: Xác thực mạng WiFi SSID và Client IP của quán trước khi cho phép vào giao diện gọi món
    /// </summary>
    [AllowAnonymous]
    [HttpPost("tables/verify-network")]
    [ProducesResponseType(typeof(VerifyTableNetworkResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> VerifyTableNetwork([FromBody] VerifyTableNetworkRequestDto request, CancellationToken ct)
    {
        var clientIp = GetClientIpAddress();
        var result = await _reservationService.VerifyTableNetworkAsync(request, clientIp, ct);
        return Ok(result);
    }
}

public class CancelReservationRequest
{
    public string Reason { get; set; } = string.Empty;
}
