using API.Security;
using Application.Common.Models;
using Application.DTOs.Reviews;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[EnableRateLimiting(RateLimiterExtensions.CustomerPolicy)]
[Route("api/reviews")]
public class DishReviewController : BaseApiController
{
    private readonly IDishReviewQueryRepository _reviewQueryRepo;
    private readonly IDishReviewService _reviewService;

    public DishReviewController(
        IDishReviewQueryRepository reviewQueryRepo,
        IDishReviewService reviewService)
    {
        _reviewQueryRepo = reviewQueryRepo;
        _reviewService = reviewService;
    }

    /// <summary>
    /// Lấy danh sách đánh giá đã được kiểm duyệt (hỗ trợ featured, limit, phân trang)
    /// </summary>
    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ReviewViewDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllApprovedReviews(
        [FromQuery] bool? featured = null,
        [FromQuery] int? limit = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var effectivePageSize = limit.HasValue && limit.Value > 0 ? Math.Min(limit.Value, 100) : Math.Clamp(pageSize, 1, 100);
        var effectivePage = Math.Max(1, page);
        var result = await _reviewQueryRepo.GetAllApprovedReviewsAsync(featured, effectivePage, effectivePageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// Lấy danh sách đánh giá đã được kiểm duyệt của món ăn
    /// </summary>
    [AllowAnonymous]
    [HttpGet("dishes/{dishId:int}")]
    [ProducesResponseType(typeof(PagedResult<ReviewViewDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetReviewsByDishId(int dishId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken ct = default)
    {
        var result = await _reviewQueryRepo.GetPagedReviewsByDishIdAsync(dishId, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// Lấy danh sách các đơn hàng đã hoàn tất trong 15 ngày qua cần đánh giá món ăn (để hiển thị Popup)
    /// </summary>
    [Authorize]
    [HttpGet("pending-orders")]
    [ProducesResponseType(typeof(List<PendingReviewOrderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPendingOrders(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập." });
        }

        var list = await _reviewService.GetPendingReviewOrdersAsync(userId.Value, ct);
        return Ok(list);
    }

    /// <summary>
    /// Gửi đánh giá cho món ăn sau khi hoàn tất đơn hàng (Chống spam)
    /// </summary>
    [Authorize]
    [HttpPost]
    [ProducesResponseType(typeof(ReviewViewDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> SubmitReview([FromBody] CreateReviewRequestDto request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để gửi đánh giá." });
        }

        request.UserId = userId.Value;
        var review = await _reviewService.SubmitReviewAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, review);
    }

    /// <summary>
    /// Quản lý danh sách đánh giá (tất cả trạng thái) kèm bộ lọc và bộ đếm cho Manager/Admin
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpGet("manage")]
    [ProducesResponseType(typeof(ReviewManagePagedResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetManagedReviews([FromQuery] ReviewManageFilterDto filter, CancellationToken ct = default)
    {
        var result = await _reviewQueryRepo.GetManagedReviewsAsync(filter, ct);
        return Ok(result);
    }

    /// <summary>
    /// Quản lý gửi hoặc cập nhật phản hồi chính thức của nhà hàng cho đánh giá
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("{id:int}/reply")]
    [ProducesResponseType(typeof(ReviewViewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ReplyReview(int id, [FromBody] ReplyReviewRequestDto request, CancellationToken ct)
    {
        var managerUserId = GetCurrentUserId();
        if (!managerUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        var result = await _reviewService.ReplyReviewAsync(id, request, managerUserId.Value, ct);
        return Ok(result);
    }

    /// <summary>
    /// Quản lý phê duyệt cho phép đánh giá hiển thị công khai lên thực đơn
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPut("{id:int}/approve")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ApproveReview(int id, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        await _reviewService.ApproveReviewAsync(id, staffUserId.Value, ct);
        return Ok(new { message = "Đã phê duyệt đánh giá thành công." });
    }

    /// <summary>
    /// Quản lý từ chối đánh giá không phù hợp tiêu chuẩn cộng đồng
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPut("{id:int}/reject")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RejectReview(int id, [FromBody] RejectReviewRequest request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        await _reviewService.RejectReviewAsync(id, request.Reason, staffUserId.Value, ct);
        return Ok(new { message = "Đã từ chối đánh giá thành công." });
    }

    /// <summary>
    /// Xóa đánh giá món ăn (CRUD)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteReview(int id, CancellationToken ct)
    {
        await _reviewService.DeleteReviewAsync(id, ct);
        return Ok(new { message = "Xóa đánh giá thành công." });
    }
}

public class RejectReviewRequest
{
    public string Reason { get; set; } = string.Empty;
}
